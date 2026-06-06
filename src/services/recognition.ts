import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { withTimeout } from "../utils/async.js";
import type { TrackInfo } from "../types.js";

const MOCK_TRACKS: TrackInfo[] = [
  {
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
  },
  {
    title: "Starboy",
    artist: "The Weeknd",
    album: "Starboy",
  },
  {
    title: "One More Time",
    artist: "Daft Punk",
    album: "Discovery",
  },
];

async function recognizeWithAudD(filePath: string): Promise<TrackInfo | null> {
  if (!config.auddToken) return null;

  const form = new FormData();
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1) || "ogg";
  form.append("api_token", config.auddToken);
  form.append("file", new Blob([buffer]), `audio.${ext}`);

  const res = await withTimeout(
    fetch("https://api.audd.io/", { method: "POST", body: form }),
    25_000,
    "AudD"
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: string;
    result?: {
      title?: string;
      artist?: string;
      album?: string;
      song_link?: string;
      spotify?: { album?: { images?: { url: string }[] } };
    };
  };

  if (data.status !== "success" || !data.result) return null;

  return {
    title: data.result.title ?? "Unknown Track",
    artist: data.result.artist ?? "Unknown Artist",
    album: data.result.album,
    artworkUrl: data.result.spotify?.album?.images?.[0]?.url,
    source: "audd",
  };
}

export async function recognizeAudio(filePath: string): Promise<TrackInfo> {
  if (config.apiMode === "live") {
    try {
      const live = await recognizeWithAudD(filePath);
      if (live) return live;
    } catch (err) {
      console.warn("[recognition] AudD failed, fallback to mock:", err);
    }
  }

  const hash = fs.statSync(filePath).size % MOCK_TRACKS.length;
  return { ...MOCK_TRACKS[hash]!, source: "mock" };
}
