/**
 * Pick daily challenge winner (random entry with remix).
 * Cron: 5 0 * * * cd /opt/mixmaster-ai && npm run daily:winner
 */
import "dotenv/config";
import { Bot } from "grammy";
import { config } from "../config.js";
import {
  getDailyChallengeByDate,
  getDailyEntries,
  setChallengeWinner,
  setRemixFeatured,
  todayKey,
} from "../db/index.js";

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const date = process.argv[2] ?? yesterdayKey();
  if (date === todayKey()) {
    console.warn("Warning: picking winner for today — usually run for yesterday.");
  }

  const challenge = getDailyChallengeByDate(date);

  if (!challenge) {
    console.log(`No challenge for ${date}`);
    process.exit(0);
  }

  if (challenge.winner_user_id) {
    console.log(`Winner already set for ${date}: user ${challenge.winner_user_id}`);
    process.exit(0);
  }

  const entries = getDailyEntries(date).filter((e) => e.remix_id);
  if (entries.length === 0) {
    console.log(`No submissions for ${date}`);
    process.exit(0);
  }

  const winner = entries[Math.floor(Math.random() * entries.length)]!;
  setChallengeWinner(date, winner.user_id);
  setRemixFeatured(winner.remix_id);

  console.log(`Winner ${date}: user=${winner.user_id} remix=${winner.remix_id}`);
  console.log(`Track: ${challenge.track_title} — ${challenge.track_artist}`);
  console.log(`Prize: ${config.dailyWinnerStars} Stars (grant manually via Telegram)`);

  if (!config.botToken) {
    console.log("BOT_TOKEN not set — skip notification");
    process.exit(0);
  }

  const bot = new Bot(config.botToken);
  try {
    await bot.api.sendMessage(
      winner.user_id,
      `🏆 *Победитель челленджа дня!*\n\n` +
        `Трек: *${challenge.track_title}*\n` +
        `Приз: ${config.dailyWinnerStars} ⭐ + Featured\n\n` +
        `Ремикс попал в витрину Featured.`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.warn("Could not DM winner:", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
