import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config.js";

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new DatabaseSync(config.dbPath);

db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    premium_until TEXT,
    remix_count_today INTEGER DEFAULT 0,
    remix_count_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS remixes (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    track_title TEXT NOT NULL,
    track_artist TEXT NOT NULL,
    style_id TEXT NOT NULL,
    style_label TEXT NOT NULL,
    preview_url TEXT NOT NULL,
    audio_path TEXT,
    featured INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
  );

  CREATE TABLE IF NOT EXISTS daily_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_date TEXT UNIQUE NOT NULL,
    track_title TEXT NOT NULL,
    track_artist TEXT NOT NULL,
    winner_user_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS daily_entries (
    user_id INTEGER NOT NULL,
    challenge_date TEXT NOT NULL,
    remix_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, challenge_date),
    FOREIGN KEY (user_id) REFERENCES users(telegram_id)
  );
`);

export function upsertUser(telegramId: number, username?: string, firstName?: string): void {
  db.prepare(
    `INSERT INTO users (telegram_id, username, first_name)
     VALUES (?, ?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET
       username = excluded.username,
       first_name = excluded.first_name`
  ).run(telegramId, username ?? null, firstName ?? null);
}

export function getUser(telegramId: number) {
  return db.prepare(`SELECT * FROM users WHERE telegram_id = ?`).get(telegramId) as
    | {
        telegram_id: number;
        username: string | null;
        first_name: string | null;
        premium_until: string | null;
        remix_count_today: number;
        remix_count_date: string | null;
      }
    | undefined;
}

export function isPremium(telegramId: number): boolean {
  const user = getUser(telegramId);
  if (!user?.premium_until) return false;
  return new Date(user.premium_until) > new Date();
}

export function setPremium(telegramId: number, days: number): void {
  const until = new Date();
  until.setDate(until.getDate() + days);
  db.prepare(`UPDATE users SET premium_until = ? WHERE telegram_id = ?`).run(
    until.toISOString(),
    telegramId
  );
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function canCreateRemix(telegramId: number): { ok: boolean; remaining: number } {
  if (isPremium(telegramId)) {
    return { ok: true, remaining: -1 };
  }
  const user = getUser(telegramId);
  const today = todayKey();
  let count = 0;
  if (user?.remix_count_date === today) {
    count = user.remix_count_today ?? 0;
  }
  const remaining = Math.max(0, config.freeRemixesPerDay - count);
  return { ok: remaining > 0, remaining };
}

export function incrementRemixCount(telegramId: number): void {
  if (isPremium(telegramId)) return;
  const today = todayKey();
  const user = getUser(telegramId);
  if (user?.remix_count_date === today) {
    db.prepare(
      `UPDATE users SET remix_count_today = remix_count_today + 1 WHERE telegram_id = ?`
    ).run(telegramId);
  } else {
    db.prepare(
      `UPDATE users SET remix_count_today = 1, remix_count_date = ? WHERE telegram_id = ?`
    ).run(today, telegramId);
  }
}

export function saveRemix(remix: {
  id: string;
  userId: number;
  trackTitle: string;
  trackArtist: string;
  styleId: string;
  styleLabel: string;
  previewUrl: string;
  audioPath?: string;
}): void {
  db.prepare(
    `INSERT INTO remixes (id, user_id, track_title, track_artist, style_id, style_label, preview_url, audio_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    remix.id,
    remix.userId,
    remix.trackTitle,
    remix.trackArtist,
    remix.styleId,
    remix.styleLabel,
    remix.previewUrl,
    remix.audioPath ?? null
  );
}

export function getRemix(id: string) {
  return db.prepare(`SELECT * FROM remixes WHERE id = ?`).get(id) as
    | {
        id: string;
        user_id: number;
        track_title: string;
        track_artist: string;
        style_id: string;
        style_label: string;
        preview_url: string;
        audio_path: string | null;
        featured: number;
        created_at: string;
      }
    | undefined;
}

export function searchRemixes(query: string, limit = 10) {
  const q = `%${query}%`;
  return db
    .prepare(
      `SELECT * FROM remixes
       WHERE track_title LIKE ? OR track_artist LIKE ? OR style_label LIKE ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(q, q, q, limit) as Array<{
      id: string;
      user_id: number;
      track_title: string;
      track_artist: string;
      style_id: string;
      style_label: string;
      preview_url: string;
      featured: number;
    }>;
}

export function getFeaturedRemixes(limit = 5) {
  return db
    .prepare(`SELECT * FROM remixes WHERE featured = 1 ORDER BY created_at DESC LIMIT ?`)
    .all(limit);
}

export function getTodayChallenge() {
  const today = todayKey();
  return db.prepare(`SELECT * FROM daily_challenges WHERE challenge_date = ?`).get(today) as
    | { id: number; challenge_date: string; track_title: string; track_artist: string }
    | undefined;
}

export function getDailyChallengeByDate(date: string) {
  return db.prepare(`SELECT * FROM daily_challenges WHERE challenge_date = ?`).get(date) as
    | {
        winner_user_id: number | null;
        track_title: string;
        track_artist: string;
      }
    | undefined;
}

export function ensureTodayChallenge(): { track_title: string; track_artist: string } {
  const existing = getTodayChallenge();
  if (existing) return existing;
  const hits = [
    { track_title: "Blinding Lights", track_artist: "The Weeknd" },
    { track_title: "Levitating", track_artist: "Dua Lipa" },
    { track_title: "As It Was", track_artist: "Harry Styles" },
  ];
  const pick = hits[new Date().getDate() % hits.length]!;
  db.prepare(
    `INSERT INTO daily_challenges (challenge_date, track_title, track_artist) VALUES (?, ?, ?)`
  ).run(todayKey(), pick.track_title, pick.track_artist);
  return pick;
}

export function hasDailyEntry(userId: number, date = todayKey()): boolean {
  const row = db
    .prepare(`SELECT 1 FROM daily_entries WHERE user_id = ? AND challenge_date = ?`)
    .get(userId, date);
  return !!row;
}

export function registerDailyEntry(userId: number, date = todayKey()): void {
  db.prepare(
    `INSERT INTO daily_entries (user_id, challenge_date) VALUES (?, ?)
     ON CONFLICT(user_id, challenge_date) DO NOTHING`
  ).run(userId, date);
}

export function linkDailyRemix(userId: number, remixId: string, date = todayKey()): void {
  db.prepare(
    `UPDATE daily_entries SET remix_id = ? WHERE user_id = ? AND challenge_date = ?`
  ).run(remixId, userId, date);
}

export function getDailyEntries(date = todayKey()) {
  return db
    .prepare(
      `SELECT user_id, remix_id FROM daily_entries WHERE challenge_date = ? AND remix_id IS NOT NULL`
    )
    .all(date) as Array<{ user_id: number; remix_id: string }>;
}

export function getDailyEntriesAll(date = todayKey()) {
  return db
    .prepare(`SELECT user_id, remix_id FROM daily_entries WHERE challenge_date = ?`)
    .all(date) as Array<{ user_id: number; remix_id: string | null }>;
}

export function setChallengeWinner(date: string, userId: number): void {
  db.prepare(`UPDATE daily_challenges SET winner_user_id = ? WHERE challenge_date = ?`).run(
    userId,
    date
  );
}

export function setRemixFeatured(remixId: string): void {
  db.prepare(`UPDATE remixes SET featured = 1 WHERE id = ?`).run(remixId);
}

export { todayKey };
