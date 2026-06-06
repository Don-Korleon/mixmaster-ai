# Deploy MixMaster AI on VPS

## Requirements

- Ubuntu 22.04+ / Debian 12+
- Domain with DNS A-record → server IP
- Ports 80/443 open

## 1. Server setup

```bash
sudo apt update && sudo apt install -y git nginx certbot python3-certbot-nginx
```

Clone project:

```bash
git clone <your-repo-url> /opt/mixmaster-ai
cd /opt/mixmaster-ai
cp .env.example .env
nano .env
```

Required in `.env`:

```
BOT_TOKEN=...
BOT_USERNAME=your_bot
PUBLIC_URL=https://your-domain.com
WEBAPP_URL=https://your-domain.com/webapp/
WEBHOOK_SECRET=long-random-string
USE_WEBHOOK=true
API_MODE=mock
```

## 2. SSL + Nginx

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/mixmaster
sudo nano /etc/nginx/sites-available/mixmaster   # set YOUR_DOMAIN
sudo ln -sf /etc/nginx/sites-available/mixmaster /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
```

## 3. Deploy with Docker

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

The script builds containers, starts them, and calls `setWebhook`.

## 4. BotFather

- Web App URL → `WEBAPP_URL`
- Menu button → same URL
- Inline mode enabled

## 5. Daily winner cron

```bash
crontab -e
```

Add (00:05 UTC daily):

```
5 0 * * * cd /opt/mixmaster-ai && docker compose exec -T mixmaster node dist/jobs/daily-winner.js >> /var/log/mixmaster-winner.log 2>&1
```

Winner gets Featured placement; grant 500 ⭐ manually via Telegram support tools if needed.

## Updates

```bash
cd /opt/mixmaster-ai
./scripts/deploy.sh
```

Skip git pull:

```bash
./scripts/deploy.sh --no-pull
```
