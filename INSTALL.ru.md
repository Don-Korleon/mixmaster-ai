# Установка MixMaster AI

Telegram-бот + Mini App для AI-ремиксов.  
Стек: Node.js 20+, TypeScript, Express, grammY, SQLite, Vite.

**Путь проекта (пример):** `D:\Егор\apps\apps\music`

---

## Требования

- **Node.js 22.5+** (встроенный `node:sqlite`; у вас подойдёт **v26**) и **npm** — [nodejs.org](https://nodejs.org/)
- Токен бота от [@BotFather](https://t.me/BotFather)
- Для Mini App в продакшене — **домен с HTTPS**
- Для VPS-деплоя — Docker (опционально, но рекомендуется)

---

## 1. Создание бота в Telegram

1. Откройте [@BotFather](https://t.me/BotFather).
2. Команда `/newbot` — задайте имя и username (например `mixmaster_ai`).
3. Сохраните **токен** — он понадобится как `BOT_TOKEN`.
4. Дополнительные настройки:
   - `/setinline` — включить **Inline Mode**
   - `/setcommands`:
     ```
     start - Приветствие
     remix - Загрузить трек
     daily - Челлендж дня
     premium - Premium подписка
     help - Справка
     ```
   - `/setdescription` — описание бота (по желанию)
   - `/setuserpic` — аватар DJ-робота (по желанию)

URL Mini App и Menu Button настраиваются **после** появления HTTPS-адреса (см. разделы 3 и 4).

---

## 2. Переменные окружения

Скопируйте шаблон и отредактируйте `.env`:

**Windows (PowerShell):**

```powershell
cd "D:\Егор\apps\apps\music"
Copy-Item .env.example .env
notepad .env
```

**Linux / macOS:**

```bash
cd /path/to/music
cp .env.example .env
nano .env
```

### Минимум для локальной разработки

```env
BOT_TOKEN=123456:ABC...ваш_токен
BOT_USERNAME=ваш_bot_username
API_MODE=mock
USE_WEBHOOK=false
PORT=3000
PUBLIC_URL=http://localhost:3000
WEBAPP_URL=http://localhost:3000/webapp/
WEBHOOK_SECRET=любая-длинная-случайная-строка
```

| Переменная | Назначение |
|------------|------------|
| `BOT_TOKEN` | Токен от BotFather |
| `BOT_USERNAME` | Username бота без `@` |
| `API_MODE=mock` | Демо без ключей AudD/Mubert |
| `USE_WEBHOOK=false` | Long polling на своём ПК |
| `PUBLIC_URL` | Базовый URL сервера |
| `WEBAPP_URL` | URL Mini App (обычно `PUBLIC_URL` + `/webapp/`) |
| `WEBHOOK_SECRET` | Секрет для webhook (продакшен) |

Полный список переменных — в файле `.env.example`.

---

## 3. Установка на компьютере (разработка)

> БД использует встроенный модуль **`node:sqlite`** — не нужны Visual Studio Build Tools и пакет `better-sqlite3`.

```powershell
cd "D:\Егор\apps\apps\music"

npm install
cd webapp
npm install
npm run build
cd ..

npm run dev
```

- Сервер: `http://localhost:3000`
- Проверка: `http://localhost:3000/api/health` → `{"ok":true,"mode":"mock"}`
- В Telegram: найдите бота → `/start` → отправьте аудио или голосовое

### Mini App на локальной машине (нужен HTTPS)

Telegram открывает Web App только по **HTTPS**.

1. Установите [ngrok](https://ngrok.com) или аналог:
   ```powershell
   ngrok http 3000
   ```
2. В `.env` укажите выданный адрес:
   ```env
   PUBLIC_URL=https://xxxx.ngrok-free.app
   WEBAPP_URL=https://xxxx.ngrok-free.app/webapp/
   ```
3. Перезапустите `npm run dev`.
4. В BotFather:
   - `/setmenubutton` → Web App → URL = ваш `WEBAPP_URL`
   - при необходимости Direct Link Mini App `mixer` → тот же URL

---

## 4. Продакшен на VPS (Docker)

Подробности также в [deploy/README.md](deploy/README.md).

### Требования

- VPS: Ubuntu 22.04+ / Debian 12+
- Домен с A-записью на IP сервера
- Порты **80** и **443** открыты

### 4.1. Подготовка сервера

```bash
sudo apt update && sudo apt install -y git nginx certbot python3-certbot-nginx
```

Скопируйте проект на сервер (git clone, scp и т.д.):

```bash
cd /opt/mixmaster-ai   # или ваш путь
cp .env.example .env
nano .env
```

### 4.2. `.env` для продакшена

```env
BOT_TOKEN=...
BOT_USERNAME=ваш_bot
PUBLIC_URL=https://your-domain.com
WEBAPP_URL=https://your-domain.com/webapp/
WEBHOOK_SECRET=случайная-длинная-строка-32-символа
USE_WEBHOOK=true
API_MODE=mock
NODE_ENV=production
PORT=3000
```

### 4.3. Nginx + SSL

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/mixmaster
sudo nano /etc/nginx/sites-available/mixmaster   # замените YOUR_DOMAIN
sudo ln -sf /etc/nginx/sites-available/mixmaster /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

### 4.4. Запуск через скрипт деплоя

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Скрипт:

- собирает Docker-образ;
- поднимает `docker compose up -d`;
- регистрирует webhook в Telegram.

### 4.5. Настройка BotFather (продакшен)

- **Menu Button** / Web App URL → `https://your-domain.com/webapp/`
- **Inline mode** включён

### 4.6. Cron: победитель daily challenge (опционально)

```bash
crontab -e
```

Добавьте строку (каждый день в 00:05 UTC):

```
5 0 * * * cd /opt/mixmaster-ai && docker compose exec -T mixmaster node dist/jobs/daily-winner.js >> /var/log/mixmaster-winner.log 2>&1
```

Победитель получает Featured; 500 ⭐ выдаются вручную через инструменты Telegram при необходимости.

### 4.7. Обновление

```bash
cd /opt/mixmaster-ai
./scripts/deploy.sh
```

Без `git pull`:

```bash
./scripts/deploy.sh --no-pull
```

---

## 5. Продакшен без скрипта (только Docker)

```bash
cd /opt/mixmaster-ai
cp .env.example .env
# заполните .env

docker compose up -d --build
```

Или через npm:

```bash
npm run docker:up
```

Webhook вручную (подставьте свои значения):

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook/<WEBHOOK_SECRET>",
    "secret_token": "<WEBHOOK_SECRET>",
    "drop_pending_updates": true
  }'
```

---

## 6. Проверка после установки

| Проверка | Ожидаемый результат |
|----------|---------------------|
| `GET /api/health` | `{"ok":true,"mode":"mock"}` |
| Бот `/start` | Приветствие и клавиатура |
| Отправка аудио | Карточка трека + кнопки ремиксов |
| «LAUNCH MIXER» / Menu | Открывается Mini App |
| `/premium` | Invoice в Telegram Stars (XTR) |
| `/daily` | Челлендж + кнопка «Участвовать — 50 ⭐» |
| Inline `@bot запрос` | Результаты (после создания ремиксов) |

---

## 7. Реальные API (опционально)

По умолчанию `API_MODE=mock` — распознавание и ремиксы работают в демо-режиме.

Для продакшена с живыми сервисами:

```env
API_MODE=live
AUDD_API_TOKEN=...          # https://audd.io
MUBERT_API_KEY=...          # https://mubert.com
MUBERT_COMPANY_ID=...
```

Пересоберите и перезапустите приложение.

---

## 8. Частые проблемы

| Симптом | Решение |
|---------|---------|
| Бот не отвечает | Проверьте `BOT_TOKEN`, логи: `npm run dev` или `docker compose logs -f` |
| Mini App не открывается | Нужен HTTPS; `WEBAPP_URL` совпадает с BotFather |
| Webhook не работает | `USE_WEBHOOK=true`, Nginx проксирует на `:3000`, URL = `PUBLIC_URL/webhook/WEBHOOK_SECRET` |
| `npm` не найден | Установите Node.js 22.5+ |
| `Cannot find module 'node:sqlite'` | Обновите Node до **22.5+** (`node -v`) |
| EPERM при удалении `node_modules` | Закройте Cursor, удалите папку, снова `npm install` |

---

## 9. Данные приложения

После первого запуска создаются:

| Путь | Содержимое |
|------|------------|
| `data/mixmaster.db` | Пользователи, ремиксы, челленджи |
| `uploads/` | Временные аудиофайлы с Telegram |

В Docker данные хранятся в volumes `mixmaster-data` и `mixmaster-uploads`.

---

## 10. Полезные команды

```bash
npm run dev              # разработка (hot reload)
npm run build            # сборка server + webapp
npm run start            # запуск собранного сервера
npm run typecheck        # проверка TypeScript
npm run daily:winner     # выбор победителя daily (после build)
npm run daily:winner:dev # то же через tsx (разработка)
npm run docker:up        # Docker: build + up
npm run docker:down      # остановка контейнеров
```

---

## 11. Публикация в каталоге

После публичного запуска: https://appss.pro/create-app

---

## См. также

- [README.md](README.md) — обзор проекта и API
- [deploy/README.md](deploy/README.md) — деплой на VPS
- [.env.example](.env.example) — все переменные окружения
