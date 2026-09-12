import type { Client, GuildMember, TextBasedChannel, VoiceBasedChannel } from "discord.js";
import { PermissionFlagsBits, Routes } from "discord.js";
import type { LavalinkResponse, Track } from "shoukaku";
import { GuildPlayer, trackFromShoukaku } from "./GuildPlayer";
import type { GuildPlayerEvents } from "./GuildPlayer";
import type { LyricsResult, PlayerSnapshot, ResolvedTrack, SearchResultEntry } from "./types";
import { lavalinkNodeOptions } from "@/lib/lavalink";

export interface ResolveOutcome {
  kind: "track" | "playlist" | "search" | "empty" | "error";
  track?: ResolvedTrack;
  tracks?: ResolvedTrack[];
  playlistName?: string;
}

export class MusicManager {
  readonly client: Client;
  readonly players = new Map<string, GuildPlayer>();
  private events: GuildPlayerEvents;

  constructor(client: Client, events: GuildPlayerEvents) {
    this.client = client;
    this.events = events;
  }

  get shoukaku() {
    return this.client.shoukaku;
  }

  idealNode() {
    return this.shoukaku?.getIdealNode();
  }

  // ── Voice / player lifecycle ─────────────────────────────────────

  getPlayer(guildId: string): GuildPlayer | undefined {
    return this.players.get(guildId);
  }

  async createPlayer(
    member: GuildMember,
    channel?: VoiceBasedChannel | null,
    textChannel?: TextBasedChannel | null,
  ): Promise<GuildPlayer | null> {
    const guildId = member.guild.id;
    const voice = channel ?? member.voice.channel;
    if (!voice) return null;

    const existing = this.players.get(guildId);
    if (existing) {
      const connection = this.shoukaku?.connections.get(guildId);
      if (connection && connection.channelId !== voice.id) {
        // move to new channel
        await this.shoukaku?.joinVoiceChannel({
          guildId,
          shardId: 0,
          channelId: voice.id,
          deaf: true,
        }).catch(() => {});
      }
      if (textChannel) existing.bindTextChannel(textChannel);
      return existing;
    }

    const shoukaku = this.shoukaku;
    if (!shoukaku) return null;

    // Self-heal a stale voice connection left behind by an earlier destroy
    // (player gone from our map but the connection entry kept): joining
    // would otherwise throw "This guild already have an existing connection"
    // and playback via commands would never work again.
    if (shoukaku.connections.has(guildId)) {
      console.warn(`[slux] Cleaning stale voice connection in guild ${guildId}`);
      await shoukaku.leaveVoiceChannel(guildId).catch(() => {});
    }

    const player = await shoukaku.joinVoiceChannel({
      guildId,
      shardId: 0,
      channelId: voice.id,
      deaf: true,
    });

    const guildPlayer = new GuildPlayer(guildId, this.client, player, {
      onSnapshot: (snapshot: PlayerSnapshot) => this.events.onSnapshot?.(snapshot),
      onTrackStart: (gid, track) => this.events.onTrackStart?.(gid, track),
      onDestroy: (gid, reason) => {
        this.players.delete(gid);
        // Best-effort clear of the voice channel status — the connection is
        // still alive at this point on every destroy path.
        void this.setVoiceChannelStatus(gid, null);
        this.events.onDestroy?.(gid, reason);
      },
    });
    if (textChannel) guildPlayer.bindTextChannel(textChannel);
    this.players.set(guildId, guildPlayer);
    return guildPlayer;
  }

  async destroyPlayer(guildId: string, reason = "stopped"): Promise<void> {
    const player = this.players.get(guildId);
    if (!player) return;
    // Clear the channel status while the voice connection is still alive.
    await this.setVoiceChannelStatus(guildId, null);
    await player.destroy(reason);
    this.players.delete(guildId);
    // Fully leave the voice channel and clear shoukaku's connection so a
    // later play can rejoin cleanly instead of failing on a stale entry.
    await this.shoukaku?.leaveVoiceChannel(guildId).catch(() => {});
  }

  // ── Voice channel status ─────────────────────────────────────────

  private voiceStatusWarned = new Set<string>();

  /**
   * Set (or clear with null) the status text shown under the voice channel
   * name. Uses the dedicated `PUT /channels/{id}/voice-status` endpoint and
   * requires the "Set Voice Channel Status" permission.
   */
  async setVoiceChannelStatus(guildId: string, status: string | null): Promise<void> {
    const channelId = this.shoukaku?.connections.get(guildId)?.channelId;
    if (!channelId) return;

    // Permission check upfront — hint once instead of failing on every track.
    const channel = this.client.channels.cache.get(channelId);
    const me = this.client.guilds.cache.get(guildId)?.members.me;
    if (channel && me && channel.isDMBased() === false) {
      const allowed = channel.permissionsFor(me)?.has(PermissionFlagsBits.SetVoiceChannelStatus);
      if (allowed === false) {
        if (!this.voiceStatusWarned.has(guildId)) {
          this.voiceStatusWarned.add(guildId);
          console.warn(
            `[slux] Missing "Set Voice Channel Status" permission in guild ${guildId} — ` +
              `channel status updates disabled. Grant it to the bot's role in Server Settings ` +
              `(or re-invite with the updated invite link).`,
          );
        }
        return;
      }
    }

    try {
      await this.client.rest.put(Routes.channelVoiceStatus(channelId), {
        body: { status },
      });
      this.voiceStatusWarned.delete(guildId);
    } catch (err) {
      // Some API variants want DELETE for clearing — best-effort fallback.
      if (status === null) {
        const cleared = await this.client.rest
          .delete(Routes.channelVoiceStatus(channelId))
          .then(() => true)
          .catch(() => false);
        if (cleared) return;
      }
      if (!this.voiceStatusWarned.has(guildId)) {
        this.voiceStatusWarned.add(guildId);
        console.warn(
          `[slux] Could not set voice channel status in guild ${guildId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  // ── Search / resolve ─────────────────────────────────────────────

  private static extractTracks(response: LavalinkResponse | undefined): Track[] {
    if (!response) return [];
    if (response.loadType === "track") return [response.data];
    if (response.loadType === "playlist") return response.data.tracks;
    if (response.loadType === "search") return response.data;
    return [];
  }

  private static isUrl(query: string): boolean {
    return /^https?:\/\//i.test(query.trim());
  }

  private static hasSourcePrefix(query: string): boolean {
    return /^[a-z]{2,10}(search|isrc|rec):/i.test(query.trim());
  }

  /** Unified LavaSearch endpoint (`/v4/loadsearch`) with a source prefix.
   *  `amsearch:` (Apple Music) works without credentials and returns the
   *  cleanest metadata; playback mirrors to YouTube via the providers chain.
   *  Returns [] when unavailable or empty. */
  private async loadSearch(query: string, limit: number): Promise<Track[]> {
    try {
      const data = (await this.lavalinkFetch(
        `/v4/loadsearch?query=${encodeURIComponent(query)}&types=track`,
      )) as { tracks?: Track[] } | null;
      return (data?.tracks ?? []).slice(0, limit);
    } catch {
      return [];
    }
  }

  async resolve(
    query: string,
    requester: { id: string; tag: string; avatar: string },
    forceSearch = false,
  ): Promise<ResolveOutcome> {
    const node = this.idealNode();
    if (!node) return { kind: "error" };

    const trimmed = query.trim();
    const requesterInfo = { id: requester.id, tag: requester.tag, avatar: requester.avatar };

    // Plain text queries: Apple Music search first (clean titles/artwork/ISRC),
    // then SoundCloud, then YouTube — catalog playback mirrors and SoundCloud
    // streams work everywhere; YouTube stream loading is login-walled on
    // many server IPs.
    if (!MusicManager.isUrl(trimmed) && !MusicManager.hasSourcePrefix(trimmed)) {
      const searchTracks = await this.loadSearch(`amsearch:${trimmed}`, 5);
      if (searchTracks.length > 0) {
        const tracks = searchTracks.map((t) => trackFromShoukaku(t, requesterInfo));
        if (forceSearch || tracks.length > 1) return { kind: "search", tracks };
        return { kind: "track", track: tracks[0] };
      }
      // Classic SoundCloud search (LavaSearch's unified endpoint does not
      // route the scsearch: prefix)
      const scRes = await node.rest.resolve(`scsearch:${trimmed}`).catch(() => undefined);
      if (scRes?.loadType === "search" && scRes.data.length > 0) {
        const tracks = scRes.data.slice(0, 5).map((t) => trackFromShoukaku(t, requesterInfo));
        if (forceSearch || tracks.length > 1) return { kind: "search", tracks };
        return { kind: "track", track: tracks[0] };
      }
      // fall through to ytsearch fallback below
    }

    const identifier = MusicManager.isUrl(trimmed) || MusicManager.hasSourcePrefix(trimmed)
      ? trimmed
      : `ytsearch:${trimmed}`;

    let response: LavalinkResponse | undefined;
    try {
      response = await node.rest.resolve(identifier);
    } catch {
      return { kind: "error" };
    }

    if (!response || response.loadType === "empty") return { kind: "empty" };
    if (response.loadType === "error") return { kind: "error" };

    if (response.loadType === "track") {
      return { kind: "track", track: trackFromShoukaku(response.data, requesterInfo) };
    }

    if (response.loadType === "playlist") {
      const tracks = response.data.tracks
        .slice(0, 1000)
        .map((t) => trackFromShoukaku(t, requesterInfo));
      if (tracks.length === 0) return { kind: "empty" };
      if (tracks.length === 1) return { kind: "track", track: tracks[0] };
      return { kind: "playlist", tracks, playlistName: response.data.info.name };
    }

    // search results
    const tracks = response.data.slice(0, 5).map((t) => trackFromShoukaku(t, requesterInfo));
    if (tracks.length === 0) return { kind: "empty" };
    if (forceSearch || tracks.length > 1) {
      return { kind: "search", tracks };
    }
    return { kind: "track", track: tracks[0] };
  }

  /** Search-only helper used by the dashboard search box. */
  async search(query: string, limit = 10): Promise<SearchResultEntry[]> {
    const node = this.idealNode();
    if (!node) return [];
    const trimmed = query.trim();

    let tracks: Track[] = [];
    if (!MusicManager.isUrl(trimmed) && !MusicManager.hasSourcePrefix(trimmed)) {
      tracks = await this.loadSearch(`amsearch:${trimmed}`, limit);
      if (tracks.length === 0) {
        const scRes = await node.rest.resolve(`scsearch:${trimmed}`).catch(() => undefined);
        if (scRes?.loadType === "search") tracks = scRes.data.slice(0, limit);
      }
    }
    if (tracks.length === 0) {
      try {
        const identifier = MusicManager.isUrl(trimmed) || MusicManager.hasSourcePrefix(trimmed)
          ? trimmed
          : `ytsearch:${trimmed}`;
        tracks = MusicManager.extractTracks(await node.rest.resolve(identifier)).slice(0, limit);
      } catch {
        return [];
      }
    }

    return tracks.map((t) => ({
      encoded: t.encoded,
      title: t.info.title,
      author: t.info.author,
      length: t.info.length,
      uri: t.info.uri ?? "",
      artwork: t.info.artworkUrl ?? "",
      sourceName: t.info.sourceName,
      identifier: t.info.identifier,
      isStream: t.info.isStream,
    }));
  }

  /** Decode a base64 track into a playable ResolvedTrack. */
  async decode(encoded: string, requester?: { id: string; tag: string; avatar: string }): Promise<ResolvedTrack | null> {
    const node = this.idealNode();
    if (!node) return null;
    try {
      const track = await node.rest.decode(encoded);
      if (!track) return null;
      return trackFromShoukaku(track, requester);
    } catch {
      return null;
    }
  }

  // ── Lyrics (LavaLyrics REST) ─────────────────────────────────────

  private lyricsCache = new Map<string, { result: LyricsResult | null; expires: number }>();
  private static LYRICS_TTL_MS = 10 * 60 * 1000;
  private static LYRICS_NEGATIVE_TTL_MS = 3 * 60 * 1000;

  private lyricsCacheKey(title: string, author: string): string {
    return `${title.toLowerCase().trim()}::${author.toLowerCase().trim()}`;
  }

  private lyricsCacheGet(key: string): { result: LyricsResult | null } | undefined {
    const entry = this.lyricsCache.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.lyricsCache.delete(key);
      return undefined;
    }
    return entry;
  }

  private lyricsCacheSet(key: string, result: LyricsResult | null): void {
    this.lyricsCache.set(key, {
      result,
      expires: Date.now() + (result ? MusicManager.LYRICS_TTL_MS : MusicManager.LYRICS_NEGATIVE_TTL_MS),
    });
    if (this.lyricsCache.size > 200) {
      const oldest = this.lyricsCache.keys().next().value;
      if (oldest !== undefined) this.lyricsCache.delete(oldest);
    }
  }

  /** Cached lyrics lookup for a track: session endpoint first, then query fallback. */
  async lyricsForTrack(
    guildId: string,
    track: { title: string; author: string },
  ): Promise<LyricsResult | null> {
    const key = this.lyricsCacheKey(track.title, track.author);
    const cached = this.lyricsCacheGet(key);
    if (cached) return cached.result;

    let result = await this.lyrics(guildId, track).catch(() => null);
    if (!result) {
      result = await this.lyricsForQuery(`${track.title} ${track.author}`, track).catch(() => null);
    }
    this.lyricsCacheSet(key, result);
    return result;
  }

  async lyrics(
    guildId: string,
    track?: { title: string; author: string } | null,
  ): Promise<LyricsResult | null> {
    const node = this.idealNode();
    if (!node?.sessionId) return null;
    try {
      const res = await this.lavalinkFetch(
        `/v4/sessions/${node.sessionId}/players/${guildId}/track/lyrics`,
      );
      return MusicManager.parseLyrics(res, track ?? undefined);
    } catch {
      return null;
    }
  }

  async lyricsForQuery(
    query: string,
    track?: { title: string; author: string } | null,
  ): Promise<LyricsResult | null> {
    // /v4/lyrics requires an encoded track — resolve the query first
    const outcome = await this.resolve(query, {
      id: "lyrics",
      tag: "Lyrics lookup",
      avatar: "",
    });
    const encoded = outcome.track?.encoded ?? outcome.tracks?.[0]?.encoded;
    if (!encoded) return null;
    try {
      const res = await this.lavalinkFetch(`/v4/lyrics?track=${encodeURIComponent(encoded)}`);
      return MusicManager.parseLyrics(res, track ?? undefined);
    } catch {
      return null;
    }
  }

  /** Raw GET against a Lavalink node's REST API (lyrics, loadsearch).
   *  Uses whichever node is currently ideal, so requests keep working when
   *  the main node is offline and the backup has taken over. */
  private async lavalinkFetch(path: string): Promise<unknown> {
    const node = this.idealNode();
    if (!node) throw new Error("no Lavalink node connected");
    // The shoukaku Node keeps its URL/auth private — resolve the matching
    // configured node options (main/backup) by name instead.
    const opts = lavalinkNodeOptions().find((n) => n.name === node.name);
    if (!opts) throw new Error(`unknown node "${node.name}"`);
    const base = `${opts.secure ? "https" : "http"}://${opts.url}`;
    const res = await fetch(base + path, {
      headers: { Authorization: opts.auth },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`Lavalink REST ${res.status}`);
    return res.json();
  }

  private static parseLyrics(
    data: unknown,
    meta?: { title: string; author: string },
  ): LyricsResult | null {
    if (!data || typeof data !== "object") return null;
    const obj = data as Record<string, unknown>;
    const lines = Array.isArray(obj.lines) ? obj.lines : [];
    const source = (obj.sourceName as string) || (obj.provider as string) || "";
    const text = typeof obj.text === "string" ? obj.text : undefined;
    const trackTitle = meta?.title ?? ((obj.trackTitle as string) || "");
    const artist = meta?.author ?? ((obj.artist as string) || "");

    if (lines.length > 0) {
      const parsed = (lines as Record<string, unknown>[]).map((line) => ({
        timestamp: (line.timestamp as number) ?? 0,
        line: (line.line as string) ?? "",
      }));
      const synced = parsed.some((l) => l.timestamp > 0);
      return {
        trackTitle,
        artist,
        source,
        synced,
        lines: parsed,
      };
    }

    if (text) {
      return { trackTitle, artist, source, synced: false, lines: [], text };
    }
    return null;
  }

  // ── Stats ────────────────────────────────────────────────────────

  stats() {
    const node = this.idealNode();
    return {
      players: this.players.size,
      playingPlayers: [...this.players.values()].filter((p) => p.current).length,
      nodeStats: node?.stats ?? null,
      nodePenalties: node?.penalties ?? null,
    };
  }
}
