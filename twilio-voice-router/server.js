const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const express = require('express');
const { Pool } = require('pg');
const twilio = require('twilio');

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = twilio.twiml.VoiceResponse;

const app = express();
const port = Number(process.env.PORT || 4800);
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DATABASE || 'chatwoot',
  user: process.env.POSTGRES_USERNAME || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  max: 4,
});

function twilioReady() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_API_KEY_SID &&
      process.env.TWILIO_API_KEY_SECRET &&
      process.env.TWILIO_TWIML_APP_SID
  );
}

function normalizeIdentity(value, prefix) {
  const raw = String(value || '').trim();
  const clean = raw.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 80);
  return clean || `${prefix}-${crypto.randomUUID()}`;
}

function tokenFor(identity) {
  if (!twilioReady()) {
    const missing = [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_API_KEY_SID',
      'TWILIO_API_KEY_SECRET',
      'TWILIO_TWIML_APP_SID',
    ].filter((key) => !process.env[key]);
    const error = new Error(`Twilio Voice is not configured. Missing: ${missing.join(', ')}`);
    error.status = 503;
    throw error;
  }

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    { identity, ttl: 3600 }
  );

  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    })
  );

  return token.toJwt();
}

async function findConversation(conversationId) {
  if (!conversationId) return null;

  const { rows } = await pool.query(
    `SELECT c.id, c.account_id, c.assignee_id, c.status
       FROM conversations c
      WHERE c.id = $1
      LIMIT 1`,
    [conversationId]
  );

  return rows[0] || null;
}

async function findOpenConversationForAgent(agentId) {
  if (!agentId) return null;

  const { rows } = await pool.query(
    `SELECT c.id, c.account_id, c.assignee_id, c.status, c.updated_at
       FROM conversations c
      WHERE c.assignee_id = $1
        AND c.status IN (0, 1)
      ORDER BY c.updated_at DESC
      LIMIT 1`,
    [agentId]
  );

  return rows[0] || null;
}

async function postPrivateNote(conversationId, content) {
  const accountId = process.env.CHATWOOT_ACCOUNT_ID;
  const token = process.env.CHATWOOT_BOT_ACCESS_TOKEN;
  const baseUrl = (process.env.CHATWOOT_API_URL || publicBaseUrl).replace(/\/$/, '');

  if (!accountId || !token || !conversationId || !baseUrl || typeof fetch !== 'function') return;

  try {
    await fetch(`${baseUrl}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_access_token: token,
      },
      body: JSON.stringify({
        content,
        message_type: 'outgoing',
        private: true,
      }),
    });
  } catch (error) {
    console.warn('Failed to create Chatwoot call note:', error.message);
  }
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, twilioReady: twilioReady() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message, twilioReady: twilioReady() });
  }
});

app.get('/voice-widget.js', (_req, res) => {
  res.type('application/javascript').send(agentWidgetJavascript());
});

app.get('/assets/twilio-voice.min.js', (req, res) => {
  const candidates = [
    path.join(__dirname, 'node_modules', '@twilio', 'voice-sdk', 'dist', 'twilio.min.js'),
    path.join(__dirname, 'node_modules', '@twilio', 'voice-sdk', 'dist', 'twilio.js'),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (file) return res.sendFile(file);
  return res.redirect('https://sdk.twilio.com/js/voice/releases/2.11.1/twilio.min.js');
});

app.get('/api/token/agent/:agentId', (req, res, next) => {
  try {
    const identity = normalizeIdentity(`agent-${req.params.agentId}`, 'agent');
    res.json({ identity, token: tokenFor(identity) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/token/customer/:agentId', async (req, res, next) => {
  try {
    const customerId = normalizeIdentity(req.query.customer_id || `customer-${crypto.randomUUID()}`, 'customer');
    const conversation =
      (await findConversation(req.query.conversation_id)) ||
      (await findOpenConversationForAgent(req.params.agentId));

    res.json({
      identity: customerId,
      token: tokenFor(customerId),
      params: {
        To: normalizeIdentity(`agent-${req.params.agentId}`, 'agent'),
        AgentId: String(req.params.agentId),
        ConversationId: conversation ? String(conversation.id) : '',
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/webhooks/twilio/voice/outbound', (req, res) => {
  const twiml = new VoiceResponse();
  const target = normalizeIdentity(req.body.To || req.query.To, 'agent');
  const conversationId = req.body.ConversationId || req.query.ConversationId || '';
  const statusCallback = publicBaseUrl
    ? `${publicBaseUrl}/webhooks/twilio/voice/status?ConversationId=${encodeURIComponent(conversationId)}`
    : undefined;
  const dial = twiml.dial({
    callerId: process.env.TWILIO_CALLER_ID || undefined,
    statusCallback,
    statusCallbackEvent: statusCallback ? 'initiated ringing answered completed' : undefined,
  });
  const client = dial.client(target);

  ['AgentId', 'ConversationId', 'customerName'].forEach((name) => {
    const value = req.body[name] || req.query[name];
    if (value) client.parameter({ name, value });
  });

  res.type('text/xml').send(twiml.toString());
});

app.post('/webhooks/twilio/voice/status', async (req, res) => {
  const conversationId = req.body.ConversationId || req.query.ConversationId;
  const status = req.body.CallStatus || req.body.DialCallStatus || 'updated';
  const callSid = req.body.CallSid || req.body.ParentCallSid || 'unknown';

  await postPrivateNote(conversationId, `Twilio browser call ${status}. Call SID: ${callSid}`);
  res.sendStatus(204);
});

app.get('/call/:agentId', async (req, res) => {
  const agentId = normalizeIdentity(req.params.agentId, 'agent');
  res.type('html').send(customerCallPage({
    agentId,
    conversationId: req.query.conversation_id || '',
    publicBaseUrl,
  }));
});

app.get('/call', (_req, res) => {
  res.status(400).type('html').send('<h1>Missing agent id</h1><p>Use /call/&lt;chatwoot-agent-id&gt;.</p>');
});

app.post('/inbound-voice', (req, res) => {
  const twiml = new VoiceResponse();
  twiml.say('This workforce voice router accepts browser click to call sessions. Please use the Chatwoot call link.');
  res.type('text/xml').send(twiml.toString());
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Twilio voice router listening on ${port}`);
});

function customerCallPage({ agentId, conversationId }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Call Advanced Virtual Solutions</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f8fb; color: #172033; }
    main { width: min(92vw, 420px); padding: 28px; background: #fff; border: 1px solid #dfe4ee; border-radius: 8px; box-shadow: 0 18px 48px rgba(23, 32, 51, .12); }
    h1 { margin: 0 0 8px; font-size: 24px; line-height: 1.2; letter-spacing: 0; }
    p { margin: 0 0 18px; color: #526071; line-height: 1.5; }
    button { width: 100%; min-height: 48px; border: 0; border-radius: 6px; background: #1463ff; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    button.secondary { margin-top: 10px; background: #edf2ff; color: #18458f; }
    button:disabled { cursor: wait; opacity: .68; }
    #status { min-height: 22px; margin-top: 16px; font-size: 14px; color: #31415a; }
  </style>
</head>
<body>
  <main>
    <h1>Start voice call</h1>
    <p>Your browser will ask for microphone permission, then connect you to the assigned support agent.</p>
    <button id="start">Call now</button>
    <button id="hangup" class="secondary" hidden>Hang up</button>
    <div id="status" role="status"></div>
  </main>
  <script src="/assets/twilio-voice.min.js"></script>
  <script>
    const agentId = ${JSON.stringify(agentId)};
    const conversationId = ${JSON.stringify(conversationId)};
    const statusEl = document.getElementById('status');
    const startButton = document.getElementById('start');
    const hangupButton = document.getElementById('hangup');
    let device;
    let activeCall;

    function setStatus(message) { statusEl.textContent = message; }

    startButton.addEventListener('click', async () => {
      startButton.disabled = true;
      setStatus('Preparing secure voice session...');
      try {
        const tokenUrl = '/api/token/customer/' + encodeURIComponent(agentId) + (conversationId ? '?conversation_id=' + encodeURIComponent(conversationId) : '');
        const response = await fetch(tokenUrl);
        if (!response.ok) throw new Error(await response.text());
        const payload = await response.json();
        device = new Twilio.Device(payload.token, { logLevel: 1 });
        await device.register();
        activeCall = await device.connect({ params: payload.params });
        hangupButton.hidden = false;
        setStatus('Ringing agent...');
        activeCall.on('accept', () => setStatus('Connected'));
        activeCall.on('disconnect', () => {
          setStatus('Call ended');
          hangupButton.hidden = true;
          startButton.disabled = false;
        });
        activeCall.on('error', (error) => setStatus(error.message || 'Call failed'));
      } catch (error) {
        setStatus(error.message || 'Unable to start call');
        startButton.disabled = false;
      }
    });

    hangupButton.addEventListener('click', () => {
      if (activeCall) activeCall.disconnect();
      if (device) device.disconnectAll();
    });
  </script>
</body>
</html>`;
}

function agentWidgetJavascript() {
  return `(function () {
  if (window.__workforceTwilioVoiceWidgetActive) return;
  window.__workforceTwilioVoiceWidgetActive = true;

  var sdkPromise;
  var device;
  var registeredAgentId;
  var activeCall;

  function loadSdk() {
    if (window.Twilio && window.Twilio.Device) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = '/assets/twilio-voice.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return sdkPromise;
  }

  function currentUserId() {
    return window.chatwootConfig && window.chatwootConfig.currentUser && window.chatwootConfig.currentUser.id;
  }

  function ensurePanel() {
    var panel = document.getElementById('workforce-twilio-voice-panel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'workforce-twilio-voice-panel';
    panel.innerHTML = '<strong>Incoming WhatsApp Voice Call</strong><span id="workforce-twilio-voice-status">Voice ready</span><div><button id="workforce-twilio-accept">Accept</button><button id="workforce-twilio-reject">Reject</button></div>';
    var style = document.createElement('style');
    style.textContent = '#workforce-twilio-voice-panel{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:300px;padding:16px;background:#fff;border:1px solid #d6deea;border-radius:8px;box-shadow:0 18px 48px rgba(18,28,45,.18);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;display:none}#workforce-twilio-voice-panel strong{display:block;margin:0 0 6px;font-size:15px;line-height:1.3;letter-spacing:0}#workforce-twilio-voice-panel span{display:block;margin-bottom:12px;color:#526071;font-size:13px;line-height:1.4}#workforce-twilio-voice-panel button{min-width:88px;min-height:36px;margin-right:8px;border:0;border-radius:6px;font:inherit;font-weight:700;cursor:pointer}#workforce-twilio-accept{background:#1463ff;color:#fff}#workforce-twilio-reject{background:#edf2ff;color:#18458f}';
    document.head.appendChild(style);
    document.body.appendChild(panel);
    document.getElementById('workforce-twilio-accept').onclick = function () {
      if (activeCall) activeCall.accept();
    };
    document.getElementById('workforce-twilio-reject').onclick = function () {
      if (activeCall) activeCall.reject();
      panel.style.display = 'none';
    };
    return panel;
  }

  function setStatus(message) {
    var status = document.getElementById('workforce-twilio-voice-status');
    if (status) status.textContent = message;
  }

  async function registerAgent(agentId) {
    if (!agentId || registeredAgentId === agentId) return;
    registeredAgentId = agentId;
    await loadSdk();
    var response = await fetch('/api/token/agent/' + encodeURIComponent(agentId));
    if (!response.ok) throw new Error(await response.text());
    var payload = await response.json();
    if (device) device.destroy();
    device = new Twilio.Device(payload.token, { logLevel: 1 });
    device.on('incoming', function (call) {
      activeCall = call;
      var panel = ensurePanel();
      panel.style.display = 'block';
      setStatus('Incoming browser call');
      call.on('accept', function () { setStatus('Connected'); });
      call.on('disconnect', function () {
        setStatus('Call ended');
        panel.style.display = 'none';
      });
      call.on('cancel', function () {
        setStatus('Call cancelled');
        panel.style.display = 'none';
      });
      call.on('error', function (error) { setStatus(error.message || 'Call failed'); });
    });
    device.on('error', function (error) { console.warn('Twilio Voice device error', error); });
    await device.register();
    ensurePanel();
  }

  setInterval(function () {
    var id = currentUserId();
    if (!id) return;
    registerAgent(String(id)).catch(function (error) {
      console.warn('Unable to register Twilio Voice widget', error);
    });
  }, 3000);
})();`;
}
