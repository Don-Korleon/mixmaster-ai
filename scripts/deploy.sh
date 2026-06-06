#!/usr/bin/env bash
# MixMaster AI — VPS deploy (Ubuntu/Debian)
# Usage: ./scripts/deploy.sh [--no-pull]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NO_PULL=false
for arg in "$@"; do
  case "$arg" in
    --no-pull) NO_PULL=true ;;
    -h|--help)
      echo "Usage: $0 [--no-pull]"
      echo "  Builds and starts Docker Compose stack."
      exit 0
      ;;
  esac
done

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Copy .env.example and set BOT_TOKEN, PUBLIC_URL, WEBAPP_URL."
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

for var in BOT_TOKEN PUBLIC_URL WEBAPP_URL WEBHOOK_SECRET; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: $var is empty in .env"
    exit 1
  fi
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi

if $NO_PULL; then
  echo "Skipping git pull (--no-pull)"
elif [[ -d .git ]]; then
  echo ">>> git pull"
  git pull --ff-only
fi

echo ">>> docker compose build"
docker compose build --pull

echo ">>> docker compose up -d"
docker compose up -d

echo ">>> Setting Telegram webhook"
WEBHOOK_PATH="/webhook/${WEBHOOK_SECRET}"
WEBHOOK_URL="${PUBLIC_URL%/}${WEBHOOK_PATH}"

docker compose exec -T mixmaster node -e "
const token = process.env.BOT_TOKEN;
const url = '${WEBHOOK_URL}';
const secret = process.env.WEBHOOK_SECRET;
fetch('https://api.telegram.org/bot' + token + '/setWebhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, secret_token: secret, drop_pending_updates: true }),
})
  .then(r => r.json())
  .then(j => { console.log(JSON.stringify(j, null, 2)); if (!j.ok) process.exit(1); });
"

echo ""
echo "Deployed. Health: ${PUBLIC_URL}/api/health"
echo "Web App:  ${WEBAPP_URL}"
echo "Webhook:  ${WEBHOOK_URL}"
docker compose ps
