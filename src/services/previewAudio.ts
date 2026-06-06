import fs from "node:fs";
import path from "node:path";
import { config, type RemixStyleId } from "../config.js";

/** Mock mode: different demo track per remix style so previews don't sound identical */
const STYLE_DEMO_URLS: Record<RemixStyleId, string> = {
  lofi: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  trap: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  house: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  phonk: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  drill: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
};

const memoryCache = new Map<RemixStyleId, Buffer>();

function cachePath(styleId: RemixStyleId): string {
  return path.join(config.dataDir, `demo-preview-${styleId}.mp3`);
}

function normalizeStyleId(styleId: string): RemixStyleId {
  if (styleId in STYLE_DEMO_URLS) return styleId as RemixStyleId;
  return "lofi";
}

export function remixPreviewPath(remixId: string): string {
  return `/api/remix/${remixId}/preview`;
}

export function remixPreviewUrl(remixId: string): string {
  return `${config.publicUrl}${remixPreviewPath(remixId)}`;
}

export async function getPreviewAudioBuffer(styleId: string = "lofi"): Promise<Buffer> {
  const style = normalizeStyleId(styleId);
  const cached = memoryCache.get(style);
  if (cached) return cached;

  const filePath = cachePath(style);
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    memoryCache.set(style, buffer);
    return buffer;
  }

  fs.mkdirSync(config.dataDir, { recursive: true });
  const res = await fetch(STYLE_DEMO_URLS[style]);
  if (!res.ok) throw new Error(`Failed to fetch demo preview audio (${style})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  memoryCache.set(style, buffer);
  return buffer;
}

export async function warmPreviewAudioCache(): Promise<void> {
  await Promise.all(
    (Object.keys(STYLE_DEMO_URLS) as RemixStyleId[]).map((styleId) =>
      getPreviewAudioBuffer(styleId).catch(() => {})
    )
  );
}
