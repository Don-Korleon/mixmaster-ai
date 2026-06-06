import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

const DEMO_MP3_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
const CACHE_PATH = path.join(config.dataDir, "demo-preview.mp3");

let memoryCache: Buffer | null = null;

export function remixPreviewPath(remixId: string): string {
  return `/api/remix/${remixId}/preview`;
}

export function remixPreviewUrl(remixId: string): string {
  return `${config.publicUrl}${remixPreviewPath(remixId)}`;
}

export async function getPreviewAudioBuffer(): Promise<Buffer> {
  if (memoryCache) return memoryCache;

  if (fs.existsSync(CACHE_PATH)) {
    memoryCache = fs.readFileSync(CACHE_PATH);
    return memoryCache;
  }

  fs.mkdirSync(config.dataDir, { recursive: true });
  const res = await fetch(DEMO_MP3_URL);
  if (!res.ok) throw new Error("Failed to fetch demo preview audio");
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(CACHE_PATH, buffer);
  memoryCache = buffer;
  return buffer;
}
