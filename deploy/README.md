# VPS Deployment

This stack deploys:

- `advancedvirtualsolutions.com` -> AVS Next.js site
- `wfm.advancedvirtualsolutions.com` -> Workforce Manager frontend
- `api.advancedvirtualsolutions.com` -> Workforce backend API and `/screen-monitor` WebSocket
- `chat.advancedvirtualsolutions.com` -> Chatwoot
- `127.0.0.1:8080` on the VPS -> Evolution API

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
