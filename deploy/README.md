# VPS Deployment

This stack deploys:

- `advancedvirtualsolutions.com` -> AVS Next.js site
- `wfm.advancedvirtualsolutions.com` -> Workforce Manager frontend
- `api.advancedvirtualsolutions.com` -> Workforce backend API and `/screen-monitor` WebSocket
- `chat.advancedvirtualsolutions.com` -> Chatwoot
- `evolution.advancedvirtualsolutions.com` -> Evolution Manager UI
- `evolution-api.advancedvirtualsolutions.com` -> Evolution API
- `127.0.0.1:8080` on the VPS -> Evolution API

Caddy terminates HTTPS automatically. Point the DNS `A` records for the root domain, `www`, `wfm`, `api`, `chat`, `evolution`, and `evolution-api` to the Interserver VPS public IP before first deploy.

## First VPS Setup

Install Docker and the compose plugin on the VPS, then clone this repo:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
git clone https://github.com/Chijonze/workforce-manager.git /opt/workforce-manager
cd /opt/workforce-manager
cp .env.production.example .env.production
```

Edit `.env.production` and replace every `change-this-*` value. Generate Chatwoot's secret with:

```bash
openssl rand -hex 64
```

Chatwoot and Evolution API both use Postgres. The compose stack creates the Evolution database during the first Postgres initialization. Build and start everything:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm chatwoot bundle exec rails db:chatwoot_prepare
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## GitHub Actions Secrets

Add these repository secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_PORT` (optional, defaults to `22`)
- `VPS_APP_DIR` (optional, defaults to `/opt/workforce-manager`)
- `VPS_ENV_FILE` (optional multi-line contents for `.env.production`; leave unset if you manage it only on the VPS)

Every push to `main` will build the Node apps, SSH into the VPS, pull the repo, rebuild Docker images, run Chatwoot migrations, and restart the stack.

## Evolution API Exposure

Evolution API is intentionally bound to `127.0.0.1:8080` by default so it is reachable from the VPS and other containers without being public. To expose it publicly on a raw port, set:

```env
EVOLUTION_BIND_ADDRESS=0.0.0.0
EVOLUTION_PORT=8080
EVOLUTION_SERVER_URL=http://advancedvirtualsolutions.com:8080
```

For a public HTTPS subdomain later, add an `EVO_DOMAIN` entry and a Caddy reverse proxy block to `evolution-api:8080`.

## Evolution API QR Notes

The production compose file uses `evoapicloud/evolution-api:v2.3.0` and `evoapicloud/evolution-manager:latest`. Older `v2.1.1` API builds can create instances but return `{"count":0}` from `/instance/connect/{instance}` instead of QR/pairing data.

The manager image has shipped with an invalid Nginx cache directive in some builds. This repo mounts `deploy/evolution-manager/nginx.conf` over the bundled config to keep the manager container stable.

## Chatwoot + Evolution Setup

The Evolution API container enables Chatwoot integration with:

```env
EVOLUTION_CHATWOOT_ENABLED=true
EVOLUTION_CHATWOOT_MESSAGE_READ=true
EVOLUTION_CHATWOOT_MESSAGE_DELETE=true
EVOLUTION_CHATWOOT_IMPORT_PLACEHOLDER_MEDIA_MESSAGE=true
```

After Chatwoot is running, create or choose an admin user token in Chatwoot and note the account ID. Then configure an existing Evolution instance:

```bash
curl -X POST "https://evolution-api.advancedvirtualsolutions.com/chatwoot/set/INSTANCE_NAME" \
  -H "Content-Type: application/json" \
  -H "apikey: EVOLUTION_API_KEY" \
  -d '{
    "enabled": true,
    "accountId": "1",
    "token": "CHATWOOT_USER_ACCESS_TOKEN",
    "url": "https://chat.advancedvirtualsolutions.com",
    "signMsg": true,
    "reopenConversation": true,
    "conversationPending": false,
    "nameInbox": "Advanced Virtual Solutions WhatsApp",
    "mergeBrazilContacts": false,
    "importContacts": true,
    "importMessages": true,
    "daysLimitImportMessages": 3,
    "signDelimiter": "\n",
    "autoCreate": true,
    "organization": "Advanced Virtual Solutions",
    "logo": "https://advancedvirtualsolutions.com/favicon.ico"
  }'
```

For a new Evolution instance, pass the same Chatwoot fields in the `/instance/create` request instead of calling `/chatwoot/set/{instance}` afterward.
