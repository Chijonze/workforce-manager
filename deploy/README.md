# VPS Deployment

This stack deploys:

- `advancedvirtualsolutions.com` -> AVS Next.js site
- `wfm.advancedvirtualsolutions.com` -> Workforce Manager frontend
- `api.advancedvirtualsolutions.com` -> Workforce backend API and `/screen-monitor` WebSocket
- `chat.advancedvirtualsolutions.com` -> Chatwoot

Caddy terminates HTTPS automatically. Point the DNS `A` records for the root domain, `www`, `wfm`, `api`, and `chat` to the Interserver VPS public IP before first deploy.

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

Build and start everything:

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

## Voice-token security configuration

Set `TWILIO_AUTH_TOKEN` to the Twilio Console Auth Token so inbound webhooks can
be signature-verified. Set a long random `TWILIO_TOKEN_API_KEY`; token minting
now requires `Authorization: Bearer <TWILIO_TOKEN_API_KEY>` (or the configured
Chatwoot bot API token) and `X-Chatwoot-Agent-Id` matching the requested agent.
Your Chatwoot integration must send these server-side headers; do not expose
either token in browser JavaScript.
