import fs from "node:fs";
import path from "node:path";
import type { Bot, Context } from "grammy";
import { InputFile } from "grammy";
import { config } from "../config.js";
import {
  canCreateRemix,
  ensureTodayChallenge,
  getRemix,
  hasDailyEntry,
  linkDailyRemix,
  registerDailyEntry,
  searchRemixes,
  todayKey,
  upsertUser,
} from "../db/index.js";
import { getPreviewAudioBuffer } from "../services/previewAudio.js";
import { recognizeAudio } from "../services/recognition.js";
import { processAudioUpload, remixToInlineDescription, remixToInlineTitle } from "../services/remix.js";
import { withTimeout } from "../utils/async.js";
import { dailyChallengeKeyboard, mainMenuKeyboard, mixerOnlyKeyboard, remixKeyboard, remixesResultKeyboard } from "./keyboards.js";
import type { RecognitionResult } from "../types.js";
import {
  helpText,
  recognitionCaption,
  WELCOME_TEXT,
} from "./messages.js";

const AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
]);

async function sendRemixAudio(
  ctx: Context,
  remix: NonNullable<ReturnType<typeof getRemix>>
): Promise<void> {
  const buffer = await getPreviewAudioBuffer(remix.style_id);
  await ctx.replyWithAudio(new InputFile(buffer, `${remix.id}.mp3`), {
    title: remix.track_title,
    performer: remix.track_artist,
    caption: `🎧 ${remix.style_label}`,
    reply_markup: remixKeyboard({
      id: remix.id,
      userId: remix.user_id,
      trackTitle: remix.track_title,
      trackArtist: remix.track_artist,
      styleId: remix.style_id as never,
      styleLabel: remix.style_label,
      previewUrl: remix.preview_url,
      featured: !!remix.featured,
      createdAt: remix.created_at,
    }),
  });
}

async function downloadTelegramFile(
  bot: Bot,
  fileId: string,
  ext: string
): Promise<string> {
  const file = await withTimeout(bot.api.getFile(fileId), 30_000, "getFile");
  const url = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
  const res = await withTimeout(fetch(url), 120_000, "downloadFile");
  if (!res.ok) throw new Error("Failed to download file");

  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const localPath = path.join(config.uploadsDir, `${fileId}.${ext}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(localPath, buffer);
  return localPath;
}

async function sendRecognitionResult(ctx: Context, result: RecognitionResult): Promise<void> {
  const caption = recognitionCaption(result.track, result.remixes.length);
  const keyboard = remixesResultKeyboard(result.remixes);

  if (result.track.artworkUrl) {
    try {
      await withTimeout(
        ctx.replyWithPhoto(result.track.artworkUrl, {
          caption,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }),
        12_000,
        "replyWithPhoto"
      );
      return;
    } catch {
      // fallback to text
    }
  }

  await ctx.reply(caption, { parse_mode: "HTML", reply_markup: keyboard });
}

async function withProcessingAnimation(ctx: Context, fn: () => Promise<void>): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  await ctx.reply("🎵 Анализирую трек...\n_Создаю ремиксы..._", {
    parse_mode: "Markdown",
  });

  const interval = setInterval(() => {
    ctx.api.sendChatAction(chatId, "upload_voice").catch(() => {});
  }, 4000);

  ctx.api.sendChatAction(chatId, "upload_voice").catch(() => {});

  try {
    await fn();
  } finally {
    clearInterval(interval);
  }
}

export function registerHandlers(bot: Bot): void {
  bot.command("start", async (ctx) => {
    upsertUser(ctx.from!.id, ctx.from?.username, ctx.from?.first_name);
    const payload = ctx.match?.trim();
    if (payload === "premium") {
      await ctx.reply("⭐ Открой /premium для подписки MixMaster Premium.");
      return;
    }
    await ctx.reply(WELCOME_TEXT, {
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(helpText(config.freeRemixesPerDay), { parse_mode: "HTML" });
  });

  bot.command("remix", async (ctx) => {
    await ctx.reply("🎵 Отправь аудиофайл, голосовое или документ с музыкой (до 50 MB).");
  });

  bot.command("daily", async (ctx) => {
    upsertUser(ctx.from!.id, ctx.from?.username, ctx.from?.first_name);
    const challenge = ensureTodayChallenge();
    const joined = hasDailyEntry(ctx.from!.id);
    await ctx.reply(
      `🔥 *Челлендж дня*\n\nРемиксни: *${challenge.track_title}* — ${challenge.track_artist}\n\nУчастие: ${config.dailyChallengeStars} ⭐\nПобедитель: ${config.dailyWinnerStars} ⭐ + Featured\n\n${joined ? "✅ Вы участвуете — отправьте аудио этого трека боту." : "Нажмите «Участвовать» для оплаты Stars."}`,
      { parse_mode: "Markdown", reply_markup: dailyChallengeKeyboard(joined) }
    );
  });

  bot.command("premium", async (ctx) => {
    await ctx.api.sendInvoice(
      ctx.chat!.id,
      "MixMaster Premium",
      "Безлимитные ремиксы, Phonk/Drill стили, приоритетная очередь AI — 30 дней.",
      `premium-${ctx.from!.id}-${Date.now()}`,
      "XTR",
      [{ label: "Premium 30 days", amount: config.premiumStarsPrice }],
      { provider_token: "" }
    );
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payload = ctx.message.successful_payment.invoice_payload;
    if (payload.startsWith("premium-")) {
      const { setPremium } = await import("../db/index.js");
      setPremium(ctx.from!.id, 30);
      await ctx.reply("✅ Premium активирован на 30 дней! Создавай безлимитные ремиксы.");
      return;
    }
    if (payload.startsWith("daily-")) {
      const parts = payload.split("-");
      const date = parts[parts.length - 1];
      if (date === todayKey()) {
        registerDailyEntry(ctx.from!.id, date);
        const challenge = ensureTodayChallenge();
        await ctx.reply(
          `✅ Вы в челлендже дня!\n\nРемиксни *${challenge.track_title}* — ${challenge.track_artist} и отправь аудио боту.\n\nИли открой микшер через /daily.`,
          { parse_mode: "Markdown", reply_markup: dailyChallengeKeyboard(true) }
        );
      } else {
        await ctx.reply("⚠️ Платёж устарел. Используйте /daily снова.");
      }
    }
  });

  bot.on("pre_checkout_query", async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.hears("🎵 Remix a track", async (ctx) => {
    await ctx.reply("Отправь аудио или голосовое сообщение.");
  });

  bot.hears("🎛 Микшер (нужен HTTPS)", async (ctx) => {
    await ctx.reply(
      `⚠️ Mini App работает только по HTTPS.\n\n` +
        `1. Запустите: ngrok http 3000\n` +
        `2. В .env:\nWEBAPP_URL=https://ВАШ-ID.ngrok-free.app/webapp/\n` +
        `3. Перезапустите бота\n\n` +
        `Превью ремиксов доступно кнопкой ▶ после распознавания трека.`
    );
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data === "daily:join") {
      const joined = hasDailyEntry(ctx.from!.id);
      if (joined) {
        await ctx.answerCallbackQuery({ text: "Вы уже участвуете сегодня" });
        return;
      }
      await ctx.answerCallbackQuery();
      const challenge = ensureTodayChallenge();
      await ctx.api.sendInvoice(
        ctx.chat!.id,
        "Daily Challenge",
        `Участие в челлендже: ${challenge.track_title} — ${challenge.track_artist}`,
        `daily-${ctx.from!.id}-${todayKey()}`,
        "XTR",
        [{ label: "Daily entry", amount: config.dailyChallengeStars }],
        { provider_token: "" }
      );
      return;
    }

    if (data === "daily:status") {
      const joined = hasDailyEntry(ctx.from!.id);
      await ctx.answerCallbackQuery({
        text: joined ? "Участие активно — отправьте ремикс трека дня" : "Сначала оплатите участие",
        show_alert: !joined,
      });
      return;
    }

    if (data.startsWith("mixer:")) {
      const startParam = data.slice("mixer:".length);
      await ctx.answerCallbackQuery();

      if (config.webappIsHttps) {
        await ctx.reply("🎛 Откройте микшер:", {
          reply_markup: mixerOnlyKeyboard(startParam || undefined),
        });
        return;
      }

      await ctx.reply(
        `⚠️ Mini App нужен HTTPS (сейчас: ${config.webappUrl}).\n\n` +
          `Настройте ngrok и WEBAPP_URL в .env, затем перезапустите бота.\n\n` +
          `Пока используйте ▶ для прослушивания превью в чате.`
      );

      if (startParam.startsWith("remix_")) {
        const remix = getRemix(startParam.slice("remix_".length));
        if (remix) {
          try {
            await sendRemixAudio(ctx, remix);
          } catch (err) {
            console.error("[bot] mixer fallback audio failed:", err);
          }
        }
      }
      return;
    }

    if (data.startsWith("preview:") || data.startsWith("listen:")) {
      const remixId = data.split(":")[1]!;
      const remix = getRemix(remixId);
      if (!remix) {
        await ctx.answerCallbackQuery({ text: "Ремикс не найден" });
        return;
      }
      await ctx.answerCallbackQuery({ text: "▶ Отправляю превью…" });
      try {
        await sendRemixAudio(ctx, remix);
      } catch (err) {
        console.error("[bot] sendRemixAudio failed:", err);
        await ctx.reply("❌ Не удалось отправить превью. Попробуйте ещё раз.");
      }
      return;
    }
  });

  bot.on(["message:audio", "message:voice", "message:document"], async (ctx) => {
    if (!ctx.from) return;

    upsertUser(ctx.from.id, ctx.from.username, ctx.from.first_name);

    const limit = canCreateRemix(ctx.from.id);
    if (!limit.ok) {
      await ctx.reply(
        `⏳ Лимит на сегодня исчерпан (${config.freeRemixesPerDay} ремикса).\n\n/premium — безлимит за ${config.premiumStarsPrice} ⭐/мес`
      );
      return;
    }

    let fileId: string | undefined;
    let ext = "mp3";
    let voiceDuration: number | undefined;

    if (ctx.message.audio) {
      fileId = ctx.message.audio.file_id;
      ext = "mp3";
    } else if (ctx.message.voice) {
      fileId = ctx.message.voice.file_id;
      ext = "ogg";
      voiceDuration = ctx.message.voice.duration;
    } else if (ctx.message.document) {
      const doc = ctx.message.document;
      const mime = doc.mime_type ?? "";
      if (!AUDIO_MIME.has(mime) && !doc.file_name?.match(/\.(mp3|m4a|ogg|wav)$/i)) {
        await ctx.reply("⚠️ Отправь аудиофайл: MP3, M4A, OGG или WAV.");
        return;
      }
      if (doc.file_size && doc.file_size > 50 * 1024 * 1024) {
        await ctx.reply("⚠️ Файл больше 50 MB — лимит Telegram.");
        return;
      }
      fileId = doc.file_id;
      ext = path.extname(doc.file_name ?? ".mp3").slice(1) || "mp3";
    }

    if (!fileId) return;

    if (voiceDuration !== undefined && voiceDuration > 30) {
      await ctx.reply(
        "⏱ Голосовое длиннее 30 сек — распознавание может занять больше времени. " +
          "Для лучшего результата записывайте 10–20 сек фрагмент с припевом или мелодией."
      );
    }

    try {
      await withProcessingAnimation(ctx, async () => {
        const localPath = await downloadTelegramFile(bot, fileId!, ext);
        const result = await processAudioUpload(ctx.from!.id, localPath, recognizeAudio);

        if (hasDailyEntry(ctx.from!.id)) {
          const challenge = ensureTodayChallenge();
          const titleMatch =
            result.track.title.toLowerCase().includes(challenge.track_title.toLowerCase()) ||
            challenge.track_title.toLowerCase().includes(result.track.title.toLowerCase());
          if (titleMatch && result.remixes[0]) {
            linkDailyRemix(ctx.from!.id, result.remixes[0].id);
          }
        }

        await sendRecognitionResult(ctx, result);
      });
    } catch (err) {
      console.error("[bot] audio processing failed:", err);
      const msg =
        err instanceof Error && err.message.includes("timeout")
          ? "⏳ Превышено время ожидания. Попробуйте короче голосовое (10–20 сек) или MP3-файл."
          : "❌ Не удалось обработать аудио. Попробуйте другой фрагмент или формат MP3.";
      await ctx.reply(msg).catch(() => {});
    }
  });

  bot.on("inline_query", async (ctx) => {
    let query = ctx.inlineQuery.query.trim();
    if (query.startsWith("remix:")) {
      const id = query.slice(6);
      const remix = getRemix(id);
      if (remix) {
        await ctx.answerInlineQuery(
          [
            {
              type: "article",
              id: remix.id,
              title: remixToInlineTitle(remix),
              description: remixToInlineDescription(remix),
              input_message_content: {
                message_text: `🎧 ${remix.track_title} — *${remix.style_label}*\nby ${remix.track_artist}`,
                parse_mode: "Markdown",
              },
            },
          ],
          { cache_time: 300 }
        );
        return;
      }
    }
    if (!query) {
      await ctx.answerInlineQuery([], { cache_time: 0 });
      return;
    }

    const remixes = searchRemixes(query, 10);
    const results = remixes.map((r) => ({
      type: "article" as const,
      id: r.id,
      title: remixToInlineTitle(r),
      description: remixToInlineDescription(r),
      input_message_content: {
        message_text: `🎧 ${r.track_title} — *${r.style_label}*\nby ${r.track_artist}`,
        parse_mode: "Markdown" as const,
      },
      reply_markup: remixKeyboard({
        id: r.id,
        userId: r.user_id,
        trackTitle: r.track_title,
        trackArtist: r.track_artist,
        styleId: r.style_id as never,
        styleLabel: r.style_label,
        previewUrl: r.preview_url,
        featured: !!r.featured,
        createdAt: "",
      }),
    }));

    await ctx.answerInlineQuery(results, { cache_time: 30 });
  });
}

export async function setupBotCommands(bot: Bot): Promise<void> {
  try {
    await bot.api.setMyCommands([
      { command: "start", description: "Приветствие и demo" },
      { command: "remix", description: "Загрузить трек для ремикса" },
      { command: "daily", description: "Челлендж дня" },
      { command: "premium", description: "Premium подписка" },
      { command: "help", description: "Справка" },
    ]);
  } catch (err) {
    console.warn("[bot] setMyCommands failed:", err instanceof Error ? err.message : err);
  }

  if (!config.webappIsHttps) {
    console.warn(
      "[bot] WEBAPP_URL is not HTTPS — Menu Button skipped. Use ngrok or set WEBAPP_URL=https://..."
    );
    return;
  }

  try {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "🎛 Open Mixer",
        web_app: { url: config.webappUrl },
      },
    });
  } catch (err) {
    console.warn("[bot] setChatMenuButton failed:", err instanceof Error ? err.message : err);
  }
}
