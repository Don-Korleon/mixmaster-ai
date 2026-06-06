# Деплой MixMaster AI на Vercel (пошагово для новичков)

Vercel даёт **бесплатный HTTPS-адрес** вида `https://ваш-проект.vercel.app` — его нужен Telegram для Mini App и webhook бота.

---

## Что важно знать заранее

| Тема | На Vercel |
|------|-----------|
| Бот | Только **webhook** (не `npm run dev` на ПК) |
| Mini App | `https://ваш-проект.vercel.app/webapp/` |
| База SQLite | Временная (`/tmp`) — данные **могут сбрасываться** при перезапуске. Для продакшена позже лучше VPS или облачная БД |
| Распознавание | Нужны переменные `API_MODE=live` и `AUDD_API_TOKEN` |

---

## Шаг 1. Аккаунт GitHub

1. Откройте https://github.com и зарегистрируйтесь (если ещё нет).
2. GitHub — это «облако» для кода; Vercel умеет брать проект оттуда.

---

## Шаг 2. Залить проект на GitHub

### 2.1. Установите Git (если нет)

https://git-scm.com/download/win — установите с настройками по умолчанию.

### 2.2. Откройте PowerShell в папке проекта

```powershell
cd "D:\Егор\apps\apps\music"
```

### 2.3. Создайте репозиторий на GitHub

1. На GitHub: **+** → **New repository**
2. Имя, например: `mixmaster-ai`
3. **Private** или Public — на ваш выбор
4. **Не** ставьте галочки README / .gitignore (проект уже есть)
5. **Create repository**

### 2.4. Отправьте код (подставьте свой URL)

```powershell
git init
git add .
git commit -m "MixMaster AI MVP"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/mixmaster-ai.git
git push -u origin main
```

GitHub попросит войти (логин + токен или браузер).

> Файл `.env` в git **не попадёт** (он в `.gitignore`) — секреты останутся только у вас.

---

## Шаг 3. Аккаунт Vercel

1. https://vercel.com → **Sign Up**
2. Выберите **Continue with GitHub** — свяжите аккаунты.

---

## Шаг 4. Импорт проекта в Vercel

1. В Vercel: **Add New…** → **Project**
2. Найдите репозиторий `mixmaster-ai` → **Import**
3. **Framework Preset:** Other (или оставьте как определит Vercel)
4. **Build Command:** уже в `vercel.json` → `npm run build:vercel`
5. **Install Command:** `npm install && npm install --prefix webapp`
6. **Пока не жмите Deploy** — сначала переменные (шаг 5).

---

## Шаг 5. Переменные окружения (Environment Variables)

В разделе **Environment Variables** добавьте:

| Имя | Значение | Зачем |
|-----|----------|--------|
| `BOT_TOKEN` | токен от @BotFather | Бот |
| `WEBHOOK_SECRET` | длинная случайная строка, напр. `my-secret-abc-123` | Защита webhook |
| `API_MODE` | `live` или `mock` | Распознавание |
| `AUDD_API_TOKEN` | ключ с audd.io | Если `live` |
| `NODE_ENV` | `production` | Продакшен |

**После первого деплоя** добавьте (подставьте свой домен Vercel):

| Имя | Пример |
|-----|--------|
| `PUBLIC_URL` | `https://mixmaster-ai.vercel.app` |
| `WEBAPP_URL` | `https://mixmaster-ai.vercel.app/webapp/` |
| `USE_WEBHOOK` | `true` |
| `SKIP_SET_WEBHOOK` | `true` (чтобы не вызывать setWebhook при каждом холодном старте) |

Нажмите **Deploy** и дождитесь зелёной галочки **Ready**.

Ваш адрес: **Deployments** → открыть → сверху URL, например `https://mixmaster-ai-xxx.vercel.app`.

---

## Шаг 6. Проверка в браузере

Откройте:

- `https://ВАШ-ПРОЕКТ.vercel.app/api/health` → должно быть `{"ok":true,...}`
- `https://ВАШ-ПРОЕКТ.vercel.app/webapp/` → Mini App

---

## Шаг 7. Подключить Telegram webhook

В PowerShell (подставьте **токен**, **домен**, **секрет**):

```powershell
$token = "ВАШ_BOT_TOKEN"
$domain = "https://ВАШ-ПРОЕКТ.vercel.app"
$secret = "ВАШ_WEBHOOK_SECRET"

$body = @{
  url = "$domain/webhook/$secret"
  secret_token = $secret
  drop_pending_updates = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook" -Method Post -ContentType "application/json" -Body $body
```

В ответе должно быть `"ok": true`.

Проверка:

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$token/getWebhookInfo"
```

---

## Шаг 8. Настройка BotFather

1. [@BotFather](https://t.me/BotFather) → ваш бот
2. **Bot Settings** → **Menu Button** → **Configure menu button** → **Web App**
3. URL: `https://ВАШ-ПРОЕКТ.vercel.app/webapp/`
4. Текст кнопки: `🎛 Микшер`

При необходимости: **/setdescription**, **/setcommands** (см. `marketing/BOTFATHER.md`).

---

## Шаг 9. Проверка бота

1. Откройте бота в Telegram → `/start`
2. Отправьте короткое голосовое (10–20 сек с музыкой)
3. Должны прийти трек и кнопки ▶ / 🎛

Если бот молчит — снова шаг 7 (webhook) и логи в Vercel: **Project → Logs**.

---

## Обновление после изменений кода

```powershell
cd "D:\Егор\apps\apps\music"
git add .
git commit -m "update"
git push
```

Vercel **сам** пересоберёт проект за 1–3 минуты.

---

## Частые проблемы

| Проблема | Решение |
|---------|---------|
| Build failed | **Deployments** → failed → **Building** → прочитать красный лог |
| Бот не отвечает | Повторить `setWebhook`, проверить `BOT_TOKEN` |
| Mini App пустой | Открыть `/webapp/` в браузере; пересобрать с `build:vercel` |
| «Демо-трек» вместо вашего | `API_MODE=live` + `AUDD_API_TOKEN` |
| Данные пропали | На Vercel SQLite временная — для постоянной БД нужен VPS |

---

## Локально vs Vercel

| | Локально `npm run dev` | Vercel |
|--|------------------------|--------|
| URL | `localhost` | `https://....vercel.app` |
| Бот | Long polling | Webhook |
| Mini App в Telegram | Нужен ngrok | Работает сразу по HTTPS |

Можно **и локально разрабатывать**, и на Vercel держать «публичную» версию для пользователей.
