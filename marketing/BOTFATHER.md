# Тексты для @BotFather

Скопируйте нужный блок в BotFather. Лимиты Telegram указаны в скобках.

---

## Имя бота (при создании)

**Рекомендуемое отображаемое имя:**  
`MixMaster AI`

**Username (если свободен):**  
`mixmaster_ai`

---

## Описание — `/setdescription`

*Показывается в профиле бота и при первом открытии чата. До 512 символов.*

```
🎧 MixMaster AI — AI Music Remixer

Превращаю любую песню в твой уникальный трек за 30 секунд.

Как пользоваться:
• Отправь аудио, голосовое или MP3
• Получи распознавание + ремиксы: Lo-Fi, Trap, House и др.
• Нажми LAUNCH MIXER — открой микшер и послушай
• Поделись ремиксом в любом чате через inline

Команды:
/start — начать
/remix — загрузить трек
/daily — челлендж дня 🔥
/premium — безлимит и эксклюзивные стили ⭐
/help — справка

Every user is a DJ 🎛
```

*~480 символов*

---

## Краткое «О боте» — `/setabouttext`

*До 120 символов. Видно в профиле бота.*

```
AI-ремиксер: отправь песню → получи ремиксы в 5 стилях → открой микшер и поделись с друзьями.
```

*~95 символов*

---

## Команды — `/setcommands`

```
start - Приветствие и быстрый старт
remix - Загрузить трек для ремикса
daily - Челлендж дня
premium - Premium: безлимит и эксклюзивные стили
help - Справка и лимиты
```

---

## Menu Button — `/setmenubutton`

**Текст кнопки:**  
`🎛 Open Mixer`

**URL (после деплоя):**  
`https://your-domain.com/webapp/`

---

## Inline placeholder — `/setinlinefeedback` (опционально)

Если BotFather предлагает настроить inline-подсказку:

```
Поиск ремиксов MixMaster…
```

---

## Direct Link Mini App (опционально)

**Short name:** `mixer`  
**URL:** тот же, что `WEBAPP_URL` в `.env`

Пример ссылки для шеринга:  
`https://t.me/mixmaster_ai/mixer?startapp=remix_<id>`

---

## Тексты для платных функций (справочно)

**Premium invoice title:** `MixMaster Premium`  
**Premium invoice description:**  
`Безлимитные ремиксы, стили Phonk и Drill, приоритетная очередь AI — 30 дней.`

**Daily challenge invoice title:** `Daily Challenge`  
**Daily challenge invoice description:**  
`Участие в челлендже дня — ремикс хита и шанс на 500 ⭐ + Featured.`

---

## Английская версия (если нужен EN-бот)

### `/setdescription` (EN)

```
🎧 MixMaster AI — your AI music remixer

Turn any song into your unique track in 30 seconds.

• Send audio, voice, or MP3
• Get track ID + remix styles: Lo-Fi, Trap, House & more
• Tap LAUNCH MIXER to preview in the app
• Share remixes in any chat via inline mode

Commands: /start /remix /daily /premium /help

Every user is a DJ 🎛
```

### `/setabouttext` (EN)

```
AI remixer: send a song → get 5 remix styles → open the mixer and share with friends.
```
