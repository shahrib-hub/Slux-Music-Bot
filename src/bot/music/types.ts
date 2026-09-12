export interface ResolvedTrack {
  encoded: string;
  title: string;
  author: string;
  length: number;
  uri: string;
  artwork: string;
  sourceName: string;
  identifier: string;
  isrc: string;
  isStream: boolean;
  isSeekable: boolean;
  requesterId: string;
  requesterTag: string;
  requesterAvatar: string;
  fromAutoplay?: boolean;
  /** Set when this track was auto-rescued from a failed YouTube playback */
  fromRescue?: boolean;
  /** Guard so a rescued track is never rescued again */
  rescueAttempted?: boolean;
}

export type LoopMode = "off" | "track" | "queue";

export interface PlayerSnapshot {
  guildId: string;
  guildName: string;
  connected: boolean;
  channelId: string | null;
  channelName: string | null;
  playing: boolean;
  paused: boolean;
  position: number;
  /** Server unix ms timestamp when this snapshot was taken */
  updatedAt: number;
  track: ResolvedTrack | null;
  queue: ResolvedTrack[];
  history: ResolvedTrack[];
  repeat: LoopMode;
  shuffle: boolean;
  autoplay: boolean;
  stayInChannel: boolean;
  volume: number;
  filters: string[];
  djMode: boolean;
}

export interface LyricLine {
  timestamp: number;
  line: string;
}

export interface LyricsResult {
  trackTitle: string;
  artist: string;
  source: string;
  synced: boolean;
  lines: LyricLine[];
  text?: string;
}

export interface SearchResultEntry {
  encoded: string;
  title: string;
  author: string;
  length: number;
  uri: string;
  artwork: string;
  sourceName: string;
  identifier: string;
  isStream: boolean;
}

/** A fully-populated snapshot for a guild with no active player. Every field
 *  present — partial snapshots crash consumers that read them unguarded. */
export function emptyPlayerSnapshot(guildId: string, guildName = ""): PlayerSnapshot {
  return {
    guildId,
    guildName,
    connected: false,
    channelId: null,
    channelName: null,
    playing: false,
    paused: false,
    position: 0,
    updatedAt: Date.now(),
    track: null,
    queue: [],
    history: [],
    repeat: "off",
    shuffle: false,
    autoplay: false,
    stayInChannel: false,
    volume: 100,
    filters: [],
    djMode: false,
  };
}
