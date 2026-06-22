# LiveKit + Chatwoot Setup

## VPS env

Set these in production before rebuilding:

```env
LIVEKIT_DOMAIN=livekit.advancedvirtualsolutions.com
LIVEKIT_API_KEY=<random-key>
LIVEKIT_API_SECRET=<random-secret>
LIVEKIT_BIND_ADDRESS=127.0.0.1
LIVEKIT_CONTROL_PORT=7801
LIVEKIT_RTC_TCP_PORT=7881
LIVEKIT_RTC_UDP_PORT=7882
CHATWOOT_ACCOUNT_ID=<account-id>
CHATWOOT_API_INBOX_ID=<api-channel-inbox-id>
CHATWOOT_BOT_ACCESS_TOKEN=<chatwoot-api-token>
```

Open VPS firewall ports `7881/tcp` and `7882/udp`. Keep `7801` bound to `127.0.0.1`.

## Chatwoot API payload

The token server creates a contact, opens a conversation, and posts this message when a customer clicks a video button:

```json
{
  "content": "Video call request: https://advancedvirtualsolutions.com/live-video?room=avs-client-room&role=agent",
  "message_type": "incoming",
  "private": false
}
```

The room is also stored on the conversation:

```json
{
  "custom_attributes": {
    "livekit_room": "avs-client-room",
    "page_url": "https://advancedvirtualsolutions.com/contact"
  }
}
```

## Dashboard app

In Chatwoot, go to `Settings -> Integrations -> Dashboard Apps -> Add new app`.

Use:

```text
Name: AVS Live Video
URL: https://advancedvirtualsolutions.com/live-video?room={{conversation.custom_attributes.livekit_room}}&role=agent
```

Enable it for the website/API inbox used by the video token server. Agents can then open the right-side Dashboard App and press `Join`.

## Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build livekit livekit-token-server avs-frontend caddy
```
