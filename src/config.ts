import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const isVercel = !!process.env.VERCEL;
const vercelHttps = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
const dataRoot = isVercel ? "/tmp/mixmaster" : path.join(rootDir, "data");
const uploadsRoot = isVercel ? "/tmp/mixmaster/uploads" : path.join(rootDir, "uploads");

export const config = {
  botToken: process.env.BOT_TOKEN ?? "",
  botUsername: process.env.BOT_USERNAME ?? "mixmaster_ai",
  webhookSecret: process.env.WEBHOOK_SECRET ?? "dev-secret",
  publicUrl: (process.env.PUBLIC_URL ?? (vercelHttps || "http://localhost:3000")).replace(/\/$/, ""),
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  useWebhook: process.env.USE_WEBHOOK === "true" || isVercel,
  webappUrl: (
    process.env.WEBAPP_URL ??
    (vercelHttps ? `${vercelHttps}/webapp/` : "http://localhost:3000/webapp/")
  ).replace(/\/?$/, "/"),
  /** Telegram Web App / Menu Button accept only HTTPS URLs */
  webappIsHttps: (process.env.WEBAPP_URL ?? "http://localhost:3000/webapp/")
    .trim()
    .toLowerCase()
    .startsWith("https://"),
  apiMode: (process.env.API_MODE ?? "mock") as "mock" | "live",
  auddToken: process.env.AUDD_API_TOKEN ?? "",
  mubertApiKey: process.env.MUBERT_API_KEY ?? "",
  mubertCompanyId: process.env.MUBERT_COMPANY_ID ?? "",
  premiumStarsPrice: Number(process.env.PREMIUM_STARS_PRICE ?? 299),
  dailyChallengeStars: Number(process.env.DAILY_CHALLENGE_STARS ?? 50),
  dailyWinnerStars: Number(process.env.DAILY_WINNER_STARS ?? 500),
  freeRemixesPerDay: Number(process.env.FREE_REMIXES_PER_DAY ?? 3),
  dataDir: dataRoot,
  uploadsDir: uploadsRoot,
  dbPath: path.join(dataRoot, "mixmaster.db"),
};

export const REMIX_STYLES = [
  { id: "lofi", label: "Lo-Fi Mix", emoji: "🌙", premium: false },
  { id: "trap", label: "Trap Style", emoji: "🔥", premium: false },
  { id: "house", label: "House Vibes", emoji: "🏠", premium: false },
  { id: "phonk", label: "Phonk Drive", emoji: "💀", premium: true },
  { id: "drill", label: "Drill Mode", emoji: "⚡", premium: true },
] as const;

export type RemixStyleId = (typeof REMIX_STYLES)[number]["id"];
