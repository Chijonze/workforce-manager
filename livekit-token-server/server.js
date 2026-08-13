import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";

const {
  PORT = "4810",
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  LIVEKIT_PUBLIC_URL,
  LIVEKIT_AGENT_VIDEO_BASE_URL,
  CHATWOOT_API_URL,
  CHATWOOT_ACCOUNT_ID,
  CHATWOOT_API_INBOX_ID,
  CHATWOOT_BOT_ACCESS_TOKEN,
} = process.env;

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_PUBLIC_URL) {
  throw new Error("LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_PUBLIC_URL are required");
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

function cleanId(value, fallback) {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function getContactId(contact) {
  return contact?.payload?.contact?.id || contact?.payload?.id || contact?.id;
}

function getContactPayload(contact) {
  return contact?.payload?.contact || contact?.payload || contact || {};
}

function getInboxSourceId(contact, inboxId) {
  const payload = getContactPayload(contact);
  const contactInboxes = Array.isArray(payload?.contact_inboxes) ? payload.contact_inboxes : [];
  const contactInbox = contactInboxes.find((item) => Number(item?.inbox?.id) === Number(inboxId));
  return contactInbox?.source_id || payload?.source_id || payload?.identifier || "";
}

async function findChatwootContactByEmail({ headers, email }) {
  const response = await fetch(
    `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts/search?q=${encodeURIComponent(email)}`,
    { headers },
  );
  const json = await response.json().catch(() => ({}));
  const contacts = Array.isArray(json?.payload) ? json.payload : [];
  return contacts.find((contact) => String(contact?.email || "").toLowerCase() === email) || null;
}

async function ensureChatwootContact({ headers, sourceId, displayName, email }) {
  const inboxId = Number(CHATWOOT_API_INBOX_ID);
  const existingContact = await findChatwootContactByEmail({ headers, email });
  const existingContactId = getContactId(existingContact);
  const existingSourceId = getInboxSourceId(existingContact, inboxId);

  if (existingContactId && existingSourceId) {
    return {
      contactId: existingContactId,
      sourceId: existingSourceId,
      reused: true,
    };
  }

  const contactPayload = {
    inbox_id: inboxId,
    name: displayName || "Website video caller",
    identifier: sourceId,
    source_id: sourceId,
    email,
  };

  const contactRes = await fetch(
    `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts`,
    { method: "POST", headers, body: JSON.stringify(contactPayload) },
  );
  const contactJson = await contactRes.json().catch(() => ({}));
  const createdContactId = getContactId(contactJson);

  if (contactRes.ok && createdContactId) {
    return {
      contactId: createdContactId,
      sourceId: getInboxSourceId(contactJson, inboxId) || sourceId,
      reused: false,
    };
  }

  const fallbackContact = await findChatwootContactByEmail({ headers, email });
  const fallbackContactId = getContactId(fallbackContact);
  const fallbackSourceId = getInboxSourceId(fallbackContact, inboxId);

  if (fallbackContactId && fallbackSourceId) {
    return {
      contactId: fallbackContactId,
      sourceId: fallbackSourceId,
      reused: true,
    };
  }

  console.warn("Unable to create or reuse Chatwoot contact", {
    email,
    status: contactRes.status,
    response: contactJson,
  });
  throw new Error("Unable to create or reuse Chatwoot contact for website call");
}

async function postChatwootInteraction({ mode, roomName, identity, displayName, email, pageUrl }) {
  if (!CHATWOOT_API_URL || !CHATWOOT_ACCOUNT_ID || !CHATWOOT_API_INBOX_ID || !CHATWOOT_BOT_ACCESS_TOKEN) {
    return null;
  }

  const callSourceId = identity;
  const headers = {
    "api_access_token": CHATWOOT_BOT_ACCESS_TOKEN,
    "content-type": "application/json",
  };
  const { contactId, sourceId, reused } = await ensureChatwootContact({
    headers,
    sourceId: callSourceId,
    displayName,
    email,
  });

  const conversationPayload = {
    source_id: sourceId,
    inbox_id: Number(CHATWOOT_API_INBOX_ID),
    contact_id: contactId,
    status: "open",
    custom_attributes: { livekit_room: roomName || "", call_mode: mode, client_email: email, page_url: pageUrl },
  };

  const conversationRes = await fetch(
    `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations`,
    { method: "POST", headers, body: JSON.stringify(conversationPayload) },
  );
  const conversationJson = await conversationRes.json().catch(() => ({}));
  const conversationId = conversationJson?.id;

  if (!conversationRes.ok || !conversationId) {
    console.warn("Unable to create Chatwoot call conversation", {
      email,
      contactId,
      sourceId,
      status: conversationRes.status,
      response: conversationJson,
    });
    throw new Error("Unable to create Chatwoot conversation for website call");
  }

  const joinUrl = `${LIVEKIT_AGENT_VIDEO_BASE_URL || "https://advancedvirtualsolutions.com/live-video"}?room=${encodeURIComponent(roomName || "")}&role=agent&mode=${mode}`;
  const content = mode === "video"
    ? `Video call request\nClient email: ${email}\nJoin link: ${joinUrl}`
    : `Voice call request\nClient email: ${email}\nJoin link: ${joinUrl}`;

  await fetch(
    `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        content,
        message_type: "incoming",
        private: false,
      }),
    },
  );

  return { contactId, conversationId, reusedContact: reused };
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/livekit/token", async (req, res) => {
  try {
    const role = req.body?.role === "agent" ? "agent" : "customer";
    const mode = req.body?.mode === "voice" ? "voice" : "video";
    const roomName = cleanId(req.body?.roomName, `avs-${Date.now()}`);
    const identity = cleanId(req.body?.identity, `${role}-${randomUUID()}`);
    const displayName = String(req.body?.displayName || (role === "agent" ? "AVS Agent" : "Website Visitor")).slice(0, 80);
    const email = cleanEmail(req.body?.email);

    if (role === "customer" && !email) {
      return res.status(400).json({ error: "A valid email is required to start a website call" });
    }

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: displayName,
      ttl: "30m",
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const chatwoot = role === "customer"
      ? await postChatwootInteraction({ mode, roomName, identity, displayName, email, pageUrl: req.body?.pageUrl })
      : null;

    res.json({
      token: await token.toJwt(),
      url: LIVEKIT_PUBLIC_URL,
      roomName,
      identity,
      chatwoot,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to create LiveKit token" });
  }
});

app.post("/api/livekit/voice-request", async (req, res) => {
  try {
    const roomName = cleanId(req.body?.roomName, `voice-${Date.now()}`);
    const identity = cleanId(req.body?.identity, `voice-${randomUUID()}`);
    const displayName = String(req.body?.displayName || "Website voice caller").slice(0, 80);
    const email = cleanEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ error: "A valid email is required to request a website voice call" });
    }

    const chatwoot = await postChatwootInteraction({
      mode: "voice",
      roomName,
      identity,
      displayName,
      email,
      pageUrl: req.body?.pageUrl,
    });

    res.json({ ok: true, identity, roomName, chatwoot });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to create voice request" });
  }
});

app.listen(Number(PORT), () => {
  console.log(`LiveKit token server listening on ${PORT}`);
});
