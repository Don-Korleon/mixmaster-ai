import { config } from "../config.js";
import type { RemixRecord, TrackInfo } from "../types.js";

export const WELCOME_TEXT = `🎧 *MixMaster AI*
AI Music Remixer — превращаю любую песню в твой уникальный трек.

Отправь аудио, голосовое или MP3 — получишь распознавание и 5 ремикс-стилей за ~30 секунд.

Команды:
/remix — загрузить трек
/daily — челлендж дня
/premium — безлимит + эксклюзивные стили
/help — справка`;

export function recognitionCaption(track: TrackInfo, remixCount: number): string {
  const demoNote =
    track.source === "mock"
      ? "\n\n<i>🔬 Демо: это пример трека, не ваш файл. Реальное распознавание — API_MODE=live и ключ AudD в .env</i>"
      : track.source === "audd"
        ? "\n\n<i>✅ Распознано через AudD</i>"
        : "";

  return `<b>🎵 ${escapeHtml(track.title)}</b>
👤 ${escapeHtml(track.artist)}

Создано <b>${remixCount}</b> ремикс-вариантов. Кнопки <b>▶</b> — слушать, <b>🎛 Микшер</b> — Mini App.${demoNote}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function remixPreviewText(remix: RemixRecord): string {
  return `🎛 *${escapeMd(remix.styleLabel)}*
${escapeMd(remix.trackTitle)} — ${escapeMd(remix.trackArtist)}`;
}

export function helpText(freeLimit: number): string {
  const bot = `@${config.botUsername}`;
  return `<b>📖 Помощь MixMaster AI</b>

• Отправь аудиофайл или голосовое (лучше 10–20 сек с мелодией) — бот распознает трек и создаст ремиксы
• Бесплатно: ${freeLimit} ремикса в день (Lo-Fi, Trap, House)
• Premium: безлимит + Phonk, Drill + приоритетная очередь
• Inline: ${bot} + запрос — шеринг ремиксов в любом чате
• Mini App: визуальный микшер с waveform и сохранением

Поддерживаемые форматы: MP3, M4A, OGG, WAV (до 50 MB)`;
}

function escapeMd(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
