# Advanced Virtual Solutions VPS Docker Runbook

## SSH Into The VPS

From Windows PowerShell:

```powershell
ssh root@YOUR_VPS_IP
```

After logging in, always move into the project folder before running Docker Compose commands:

```bash
cd /opt/workforce-manager
```

If you see this error:

```text
couldn't find env file: /root/.env.production
```

it means you are in `/root` instead of `/opt/workforce-manager`.

## Start Or Restart The App Stack

```bash
cd /opt/workforce-manager
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Check Running Containers

```bash
cd /opt/workforce-manager
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

All main services should show `Up` or `Running`.

## View Logs

All services:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100
```

Caddy/SSL/proxy logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 caddy
```

Backend logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 workforce-backend
```

Chatwoot logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 chatwoot
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 chatwoot-worker
```


Follow live logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=100
```

## Deploy Latest GitHub Code Manually

```bash
cd /opt/workforce-manager
git pull origin main
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm chatwoot bundle exec rails db:chatwoot_prepare
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Stop The Stack

Stop containers but keep data:

```bash
cd /opt/workforce-manager
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

Do not use `down -v` unless you intentionally want to delete Docker volumes and production data.

## Restart One Service

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart workforce-backend
docker compose --env-file .env.production -f docker-compose.prod.yml restart caddy
docker compose --env-file .env.production -f docker-compose.prod.yml restart chatwoot
```

## Rebuild One Service

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build workforce-backend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build workforce-frontend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build avs-frontend
```

## Edit Production Environment

```bash
cd /opt/workforce-manager
nano .env.production
```

Save in nano:

```text
Ctrl + O
Enter
Ctrl + X
```

After editing env values:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Validate Compose Configuration

```bash
cd /opt/workforce-manager
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

This validates the compose file. It can print secrets, so do not share the full output publicly.

## Main Public URLs

```text
https://advancedvirtualsolutions.com
https://wfm.advancedvirtualsolutions.com
https://api.advancedvirtualsolutions.com
https://chat.advancedvirtualsolutions.com
```

```text
127.0.0.1:8080
```

## Useful Docker Commands

Show all containers:

```bash
docker ps -a
```

Show Docker disk usage:

```bash
docker system df
```

Clean unused build cache/images:

```bash
docker system prune
```

Be careful with:

```bash
docker system prune -a
docker volume prune
```

Those can remove more than expected.

## Basic VPS Health Checks

Disk space:

```bash
df -h
```

Memory:

```bash
free -h
```

CPU and processes:

```bash
top
```

Open ports:

```bash
ss -tulpn
```

## Quick Recovery Checklist

If the site is down:

```bash
cd /opt/workforce-manager
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 caddy
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 workforce-backend
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

If HTTPS fails, check DNS first, then Caddy logs.

If Chatwoot has database errors:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm chatwoot bundle exec rails db:chatwoot_prepare
docker compose --env-file .env.production -f docker-compose.prod.yml restart chatwoot chatwoot-worker
```
