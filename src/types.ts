import type { RemixStyleId } from "./config.js";

export interface TrackInfo {
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  source?: string;
}

export interface RemixRecord {
  id: string;
  userId: number;
  trackTitle: string;
  trackArtist: string;
  styleId: RemixStyleId;
  styleLabel: string;
  previewUrl: string;
  audioPath?: string;
  featured: boolean;
  createdAt: string;
}

export interface RecognitionResult {
  track: TrackInfo;
  remixes: RemixRecord[];
}
