import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { config, REMIX_STYLES, type RemixStyleId } from "../config.js";
import { incrementRemixCount, isPremium, saveRemix } from "../db/index.js";
import { remixPreviewUrl } from "./previewAudio.js";
import type { RecognitionResult, RemixRecord, TrackInfo } from "../types.js";

const STYLE_PROMPTS: Record<RemixStyleId, string> = {
  lofi: "lo-fi chill hop remix, warm vinyl, relaxed BPM",
  trap: "modern trap remix, heavy 808s, crisp hi-hats",
  house: "four-on-the-floor house remix, uplifting groove",
  phonk: "phonk drift remix, distorted bass, Memphis samples",
  drill: "UK drill remix, sliding 808s, dark atmosphere",
};

function mockPreviewUrl(remixId: string): string {
  return remixPreviewUrl(remixId);
}

async function generateWithMubert(
  track: TrackInfo,
  styleId: RemixStyleId
): Promise<string | null> {
  if (!config.mubertApiKey) return null;
  // Mubert API varies by plan; MVP returns null and falls back to mock URL
  void STYLE_PROMPTS[styleId];
  void track;
  return null;
}

export async function createRemixesForTrack(
  userId: number,
  track: TrackInfo,
  options?: { styles?: RemixStyleId[]; count?: number }
): Promise<RemixRecord[]> {
  const premium = isPremium(userId);
  const available = REMIX_STYLES.filter((s) => premium || !s.premium);
  const styleIds =
    options?.styles ??
    available.slice(0, options?.count ?? 5).map((s) => s.id as RemixStyleId);

  fs.mkdirSync(config.uploadsDir, { recursive: true });

  const remixes: RemixRecord[] = [];

  for (const styleId of styleIds) {
    const style = REMIX_STYLES.find((s) => s.id === styleId);
    if (!style) continue;
    if (style.premium && !premium) continue;

    const id = uuidv4().slice(0, 12);
    let previewUrl = mockPreviewUrl(id);

    if (config.apiMode === "live") {
      const mubertUrl = await generateWithMubert(track, styleId);
      if (mubertUrl) previewUrl = mubertUrl;
    }

    const record: RemixRecord = {
      id,
      userId,
      trackTitle: track.title,
      trackArtist: track.artist,
      styleId,
      styleLabel: style.label,
      previewUrl,
      featured: false,
      createdAt: new Date().toISOString(),
    };

    saveRemix({
      id,
      userId,
      trackTitle: track.title,
      trackArtist: track.artist,
      styleId,
      styleLabel: style.label,
      previewUrl,
    });

    remixes.push(record);
  }

  incrementRemixCount(userId);
  return remixes;
}

export async function processAudioUpload(
  userId: number,
  filePath: string,
  recognize: (path: string) => Promise<TrackInfo>
): Promise<RecognitionResult> {
  const track = await recognize(filePath);
  const remixes = await createRemixesForTrack(userId, track, { count: 5 });
  return { track, remixes };
}

export function remixToInlineTitle(remix: {
  track_title: string;
  track_artist: string;
  style_label: string;
}): string {
  return `${remix.track_title} — ${remix.style_label}`;
}

export function remixToInlineDescription(remix: {
  track_artist: string;
}): string {
  return `by ${remix.track_artist} · MixMaster AI`;
}
