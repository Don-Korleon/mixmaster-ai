import fs from "node:fs";
import { webhookCallback } from "grammy";
import { config } from "./config.js";
import { createBot, initBot } from "./bot/index.js";
import { createServer } from "./server/index.js";
import { getPreviewAudioBuffer } from "./services/previewAudio.js";

async function main(): Promise<void> {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  fs.mkdirSync(config.dataDir, { recursive: true });

  getPreviewAudioBuffer().catch((err) =>
    console.warn("[preview] demo audio preload failed:", err)
  );

  const app = createServer();
  const bot = createBot();

  if (config.botToken) {
    await initBot(bot);
    if (!config.webappIsHttps) {
      console.warn(
        "[webapp] WEBAPP_URL не HTTPS — кнопка «Микшер» откроет инструкцию. Для Mini App: ngrok + WEBAPP_URL=https://.../webapp/"
      );
    }

    if (config.useWebhook && config.publicUrl) {
      const path = `/webhook/${config.webhookSecret}`;
      app.use(path, webhookCallback(bot, "express"));
      await bot.api.setWebhook(`${config.publicUrl}${path}`, {
        secret_token: config.webhookSecret,
      });
      console.log(`[bot] Webhook: ${config.publicUrl}${path}`);
    } else {
      bot.start({
        onStart: (info) => console.log(`[bot] Polling as @${info.username}`),
      });
      console.log("[bot] Long polling (set USE_WEBHOOK=true for production)");
    }
  }

  app.listen(config.port, () => {
    console.log(`[server] http://localhost:${config.port}`);
    console.log(`[webapp] ${config.webappUrl}`);
    console.log(`[api] mode=${config.apiMode}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
