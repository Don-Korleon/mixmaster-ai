import { Router } from "express";
import { config, REMIX_STYLES } from "../../config.js";
import {
  canCreateRemix,
  ensureTodayChallenge,
  getRemix,
  getUser,
  hasDailyEntry,
  isPremium,
  upsertUser,
} from "../../db/index.js";
import { getPreviewAudioBuffer, remixPreviewPath } from "../../services/previewAudio.js";
import { validateInitData } from "../../utils/telegramAuth.js";

export const apiRouter = Router();

function requireUser(initData: string | undefined) {
  if (!initData) return null;
  const user = validateInitData(initData);
  if (!user) return null;
  upsertUser(user.id, user.username, user.first_name);
  return user;
}

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true, mode: config.apiMode });
});

apiRouter.get("/styles", (_req, res) => {
  res.json({ styles: REMIX_STYLES });
});

apiRouter.get("/remix/:id", (req, res) => {
  const remix = getRemix(req.params.id);
  if (!remix) {
    res.status(404).json({ error: "Remix not found" });
    return;
  }
  res.json({
    id: remix.id,
    trackTitle: remix.track_title,
    trackArtist: remix.track_artist,
    styleId: remix.style_id,
    styleLabel: remix.style_label,
    previewUrl: remixPreviewPath(remix.id),
    featured: !!remix.featured,
    createdAt: remix.created_at,
  });
});

apiRouter.get("/remix/:id/preview", async (req, res) => {
  const remix = getRemix(req.params.id);
  if (!remix) {
    res.status(404).json({ error: "Remix not found" });
    return;
  }
  try {
    const audio = await getPreviewAudioBuffer(remix.style_id);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audio.length);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(audio);
  } catch (err) {
    console.error("[api] preview audio failed:", err);
    res.status(503).json({ error: "Preview unavailable" });
  }
});

apiRouter.get("/daily", (req, res) => {
  const challenge = ensureTodayChallenge();
  const user = requireUser(req.headers["x-telegram-init-data"] as string);
  res.json({
    trackTitle: challenge.track_title,
    trackArtist: challenge.track_artist,
    joined: user ? hasDailyEntry(user.id) : false,
    entryStars: config.dailyChallengeStars,
    winnerStars: config.dailyWinnerStars,
  });
});

apiRouter.get("/me", (req, res) => {
  const user = requireUser(req.headers["x-telegram-init-data"] as string);
  if (!user) {
    res.status(401).json({ error: "Invalid init data" });
    return;
  }
  const dbUser = getUser(user.id);
  const limit = canCreateRemix(user.id);
  res.json({
    id: user.id,
    username: user.username,
    premium: isPremium(user.id),
    remixesRemaining: limit.remaining,
    freeLimit: config.freeRemixesPerDay,
    premiumUntil: dbUser?.premium_until ?? null,
  });
});

apiRouter.post("/remix/:id/save", (req, res) => {
  const user = requireUser(req.headers["x-telegram-init-data"] as string);
  if (!user) {
    res.status(401).json({ error: "Invalid init data" });
    return;
  }
  const remix = getRemix(req.params.id);
  if (!remix) {
    res.status(404).json({ error: "Remix not found" });
    return;
  }
  res.json({ saved: true, remixId: remix.id });
});

