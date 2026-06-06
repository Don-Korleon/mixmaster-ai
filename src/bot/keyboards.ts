import { InlineKeyboard, Keyboard } from "grammy";
import { config } from "../config.js";
import type { RemixRecord } from "../types.js";

export function webAppUrl(startParam?: string): string {
  const base = config.webappUrl;
  if (!startParam) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}tgWebAppStartParam=${encodeURIComponent(startParam)}`;
}

/** Callback data for opening mixer when HTTPS Web App is not configured */
export function mixerCallbackData(startParam?: string): string {
  return `mixer:${startParam ?? ""}`;
}

function inlineWebAppOrMixer(kb: InlineKeyboard, label: string, startParam?: string): InlineKeyboard {
  if (config.webappIsHttps) {
    return kb.webApp(label, webAppUrl(startParam));
  }
  return kb.text(label, mixerCallbackData(startParam));
}

export function remixKeyboard(remix: RemixRecord): InlineKeyboard {
  const kb = new InlineKeyboard();
  inlineWebAppOrMixer(kb, `🎛 Микшер`, `remix_${remix.id}`);
  kb.row().switchInline("📤 Share remix", `remix:${remix.id}`);
  return kb;
}

export function remixesResultKeyboard(remixes: RemixRecord[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const remix of remixes.slice(0, 5)) {
    kb.text(`▶ ${remix.styleLabel}`, `listen:${remix.id}`);
    inlineWebAppOrMixer(kb, `🎛 Микшер`, `remix_${remix.id}`);
    kb.row();
  }
  kb.url("⭐ Premium", `https://t.me/${config.botUsername}?start=premium`);
  return kb;
}

export function mainMenuKeyboard(): Keyboard {
  if (config.webappIsHttps) {
    return new Keyboard()
      .webApp("🎛 Микшер", webAppUrl())
      .text("🎵 Remix a track")
      .resized();
  }
  return new Keyboard().text("🎵 Remix a track").text("🎛 Микшер (нужен HTTPS)").resized();
}

export function dailyChallengeKeyboard(joined: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (joined) {
    kb.text("✅ Участие оплачено", "daily:status").row();
  } else {
    kb.text(`🎫 Участвовать — ${config.dailyChallengeStars} ⭐`, "daily:join").row();
  }
  inlineWebAppOrMixer(kb, "🎛 Remix challenge", "daily");
  return kb;
}

export function mixerOnlyKeyboard(startParam?: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  inlineWebAppOrMixer(kb, "🎛 Открыть микшер", startParam);
  return kb;
}
