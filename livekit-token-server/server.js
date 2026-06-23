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

async function postChatwootInteraction({ mode, roomName, identity, displayName, pageUrl }) {
  if (!CHATWOOT_API_URL || !CHATWOOT_ACCOUNT_ID || !CHATWOOT_API_INBOX_ID || !CHATWOOT_BOT_ACCESS_TOKEN) {
    return null;
  }

  const sourceId = identity;
  const headers = {
    "api_access_token": CHATWOOT_BOT_ACCESS_TOKEN,
    "content-type": "application/json",
  };

  const contactPayload = {
    inbox_id: Number(CHATWOOT_API_INBOX_ID),
    name: displayName || "Website video caller",
    source_id: sourceId,
    email: `${sourceId}@website-caller.local`,
  };

  const contactRes = await fetch(
    `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/contacts`,
    { method: "POST", headers, body: JSON.stringify(contactPayload) },
  );
  const contactJson = await contactRes.json().catch(() => ({}));
  const contactId = contactJson?.payload?.contact?.id || contactJson?.payload?.id || contactJson?.id;

  const conversationPayload = {
    source_id: sourceId,
    inbox_id: Number(CHATWOOT_API_INBOX_ID),
    contact_id: contactId,
    status: "open",
    custom_attributes: { livekit_room: roomName || "", call_mode: mode, page_url: pageUrl },
  };

  const conversationRes = await fetch(
    `${CHATWOOT_API_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations`,
    { method: "POST", headers, body: JSON.stringify(conversationPayload) },
  );
  const conversationJson = await conversationRes.json().catch(() => ({}));
  const conversationId = conversationJson?.id;

  if (conversationId) {
    const joinUrl = `${LIVEKIT_AGENT_VIDEO_BASE_URL || "https://advancedvirtualsolutions.com/live-video"}?room=${encodeURIComponent(roomName || "")}&role=agent&mode=${mode}`;
    const content = mode === "video"
      ? `Video call request: ${joinUrl}`
      : `Voice call request: ${joinUrl}`;

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
  }

  return { contactId, conversationId };
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/livekit/token", async (req, res) => {
  try {
    const role = req.body?.role === "agent" ? "agent" : "customer";
    const mode = req.body?.mode === "voice" ? "voice" : "video";
    const roomName = cleanId(req.body?.roomName, `avs-${Date.now()}`);
    const identity = cleanId(req.body?.identity, `${role}-${randomUUID()}`);
    const displayName = String(req.body?.displayName || (role === "agent" ? "AVS Agent" : "Website Visitor")).slice(0, 80);

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
      ? await postChatwootInteraction({ mode, roomName, identity, displayName, pageUrl: req.body?.pageUrl })
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
    const chatwoot = await postChatwootInteraction({
      mode: "voice",
      roomName,
      identity,
      displayName,
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
