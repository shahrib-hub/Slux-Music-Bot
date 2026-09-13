import type { Client, TextBasedChannel, VoiceBasedChannel } from "discord.js";
import type { Player as ShoukakuPlayer, Track } from "shoukaku";
import { buildFilters, activeFilterNames } from "./filters";
import type { LoopMode, PlayerSnapshot, ResolvedTrack } from "./types";
import { formatDuration } from "@/lib/utils";
import { normalizeLocale, t as translate } from "@/i18n";
import { getGuildSettings } from "@/db/repositories/guilds";

const HISTORY_LIMIT = 50;
const MAX_QUEUE = 500;

export interface GuildPlayerEvents {
  onSnapshot?: (snapshot: PlayerSnapshot) => void;
  onTrackStart?: (guildId: string, track: ResolvedTrack) => void;
  onDestroy?: (guildId: string, reason: string) => void;
}

export function trackFromShoukaku(track: Track, requester?: { id: string; tag: string; avatar: string }): ResolvedTrack {
  return {
    encoded: track.encoded,
    title: track.info.title,
    author: track.info.author,
    length: track.info.length,
    uri: track.info.uri ?? "",
    artwork: track.info.artworkUrl ?? "",
    sourceName: track.info.sourceName,
    identifier: track.info.identifier,
    isrc: track.info.isrc ?? "",
    isStream: track.info.isStream,
    isSeekable: track.info.isSeekable,
    requesterId: requester?.id ?? "autoplay",
    requesterTag: requester?.tag ?? "Autoplay",
    requesterAvatar: requester?.avatar ?? "",
  };
}

export class GuildPlayer {
  readonly guildId: string;
  readonly client: Client;
  player: ShoukakuPlayer;

  queue: ResolvedTrack[] = [];
  history: ResolvedTrack[] = [];
  current: ResolvedTrack | null = null;
  repeat: LoopMode = "off";
  shuffle = false;
  autoplay = false;
  stayInChannel = false;
  djMode = false;
  volume = 100;

  private activeFilters: Record<string, unknown> = {};
  private events: GuildPlayerEvents;
  private idleTimer: NodeJS.Timeout | null = null;
  private idleTimeoutMinutes = 5;
  private destroyReason: string | null = null;

  constructor(guildId: string, client: Client, player: ShoukakuPlayer, events: GuildPlayerEvents) {
    this.guildId = guildId;
    this.client = client;
    this.player = player;
    this.events = events;
    this.bindPlayerEvents();
  }

  private bindPlayerEvents(): void {
    // Every handler is guarded: an error thrown inside a Lavalink event
    // listener would otherwise escape as an uncaughtException.
    const guard = (label: string, fn: () => void | Promise<void>) => {
      try {
        const result = fn();
        if (result instanceof Promise) result.catch((err) => this.logHandlerError(label, err));
      } catch (err) {
        this.logHandlerError(label, err);
      }
    };

    this.player.on("start", (data) =>
      guard("start", () => {
        const track = this.current ?? this.queue.find((t) => t.encoded === data.track.encoded) ?? null;
        if (track) {
          this.current = track;
          this.history = [track, ...this.history].slice(0, HISTORY_LIMIT);
        }
        this.resetIdleTimer();
        this.events.onTrackStart?.(this.guildId, this.current ?? trackFromShoukaku(data.track));
        this.emit();
      }),
    );

    this.player.on("end", (data) =>
      guard("end", () => {
        if (this.destroyReason) return;
        if (data.reason === "replaced") return;
        if (data.reason === "stopped") {
          // stopTrack is used for skip; handle in skip()
          return;
        }
        // Load failures are owned by the exception handler (SoundCloud rescue);
        // an end(loadFailed) event may also fire — ignore it here.
        if (String(data.reason).toLowerCase().includes("load")) return;
        void this.handleTrackEnd();
      }),
    );

    this.player.on("exception", (data) =>
      guard("exception", () => {
        console.error(
          `[slux] player exception in guild ${this.guildId}:`,
          data.exception?.message ?? String(data.exception),
        );
        void this.handleTrackFailure();
      }),
    );

    this.player.on("stuck", () =>
      guard("stuck", () => {
        void this.playNext();
      }),
    );

    this.player.on("update", (data) =>
      guard("update", () => {
        // position updates are cheap; emit snapshot at most every second
        if (data.state?.connected) this.emitThrottled();
      }),
    );

    this.player.on("closed", () =>
      guard("closed", () => {
        void this.destroy("voice closed");
      }),
    );
  }

  private logHandlerError(label: string, err: unknown): void {
    console.error(
      `[slux] player "${label}" handler error in guild ${this.guildId}:`,
      err instanceof Error ? err.stack ?? err.message : err,
    );
  }

  private lastEmit = 0;
  private emitThrottled(): void {
    const now = Date.now();
    if (now - this.lastEmit < 900) return;
    this.lastEmit = now;
    this.emit();
  }

  // ── Dashboard heartbeat ──────────────────────────────────────────

  /**
   * While a track is playing, push a fresh snapshot to the dashboard every
   * 3 seconds: song position/duration and full player state stay live even
   * if an Lavalink update or state-change event is missed, and any client
   * interpolation drift self-corrects. Idle/paused players stay silent
   * (nothing changes while paused — the position is frozen).
   */
  private heartbeat: NodeJS.Timeout | null = null;

  private startHeartbeat(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      if (this.current && !this.player.paused) this.emit();
    }, 3_000);
    this.heartbeat.unref?.();
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  emit(): void {
    this.startHeartbeat();
    this.events.onSnapshot?.(this.snapshot());
  }

  snapshot(): PlayerSnapshot {
    const guild = this.client.guilds.cache.get(this.guildId);
    const connection = this.client.shoukaku?.connections.get(this.guildId);
    let channelName: string | null = null;
    if (connection?.channelId) {
      const ch = guild?.channels.cache.get(connection.channelId);
      channelName = ch?.name ?? null;
    }
    return {
      guildId: this.guildId,
      guildName: guild?.name ?? "",
      connected: !!connection,
      channelId: connection?.channelId ?? null,
      channelName,
      playing: !!this.current && !this.player.paused,
      paused: this.player.paused,
      position: this.player.position,
      updatedAt: Date.now(),
      track: this.current,
      queue: this.queue,
      history: this.history.slice(0, 20),
      repeat: this.repeat,
      shuffle: this.shuffle,
      autoplay: this.autoplay,
      stayInChannel: this.stayInChannel,
      volume: this.volume,
      filters: activeFilterNames(this.player.filters),
      djMode: this.djMode,
    };
  }

  // ── Queue operations ─────────────────────────────────────────────

  enqueue(track: ResolvedTrack, position?: number): void {
    if (position === undefined || position >= this.queue.length) {
      this.queue.push(track);
    } else {
      this.queue.splice(Math.max(0, position), 0, track);
    }
    if (this.queue.length > MAX_QUEUE) this.queue = this.queue.slice(0, MAX_QUEUE);
    this.emit();
  }

  enqueueMany(tracks: ResolvedTrack[], position?: number): void {
    const room = MAX_QUEUE - this.queue.length;
    const toAdd = tracks.slice(0, Math.max(0, room));
    if (position === undefined || position >= this.queue.length) {
      this.queue.push(...toAdd);
    } else {
      this.queue.splice(Math.max(0, position), 0, ...toAdd);
    }
    this.emit();
  }

  async startIfIdle(): Promise<void> {
    if (!this.current && this.queue.length > 0) {
      await this.playNext();
    }
  }

  private async handleTrackEnd(): Promise<void> {
    if (this.repeat === "track" && this.current) {
      await this.playTrack(this.current);
      return;
    }
    if (this.repeat === "queue" && this.current) {
      this.queue.push(this.current);
    }
    if (this.queue.length > 0) {
      await this.playNext();
      return;
    }
    if (this.autoplay) {
      const injected = await this.fetchAutoplayTrack();
      if (injected) {
        injected.fromAutoplay = true;
        this.queue.push(injected);
        await this.playNext();
        return;
      }
    }
    this.current = null;
    this.emit();
    this.startIdleTimer();
  }

  /**
   * A track failed mid-playback. Most commonly the playback mirror (YouTube)
   * is login-walled on the server's IP. Attempt one automatic SoundCloud
   * rescue for any non-SoundCloud track before giving up and skipping.
   */
  private failureInProgress = false;

  private async handleTrackFailure(): Promise<void> {
    if (this.destroyReason || this.failureInProgress) return;
    this.failureInProgress = true;
    try {
      const failed = this.current;
      // Note: catalog sources (Apple Music, Spotify...) are mirrored to a
      // playback source by LavaSrc, so ANY sourceName can fail through
      // YouTube — rescue everything except SoundCloud itself.
      if (failed && !failed.rescueAttempted && failed.sourceName !== "soundcloud") {
        const rescued = await this.rescueViaSoundCloud(failed);
        if (rescued) {
          rescued.rescueAttempted = true;
          rescued.fromRescue = true;
          await this.playTrack(rescued);
          return;
        }
      }
      await this.playNext();
    } catch (err) {
      this.logHandlerError("trackFailure", err);
      await this.playNext().catch(() => {});
    } finally {
      this.failureInProgress = false;
    }
  }

  /** Re-resolve a failed YouTube track on SoundCloud, keeping requester info. */
  private async rescueViaSoundCloud(track: ResolvedTrack): Promise<ResolvedTrack | null> {
    try {
      const cleaned = `${track.title} ${track.author}`
        .replace(/[([](official|lyrics?|audio|video|hd|4k|remaster\w*|explicit|mv|visualizer)[^)\]]*[)\]]/gi, "")
        .replace(/\s*[-–|]\s*(official|topic)\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      const res = await this.player.node.rest.resolve(`scsearch:${cleaned}`);
      if (res?.loadType === "search" && res.data.length > 0) {
        // Prefer the first result by the same artist — SoundCloud search
        // often ranks covers above originals.
        const artist = track.author.toLowerCase().split(/\s*[-–]\s*/)[0]?.trim();
        const sameArtist = artist
          ? res.data.find((t) => t.info.author.toLowerCase().includes(artist))
          : undefined;
        const pick: Track = sameArtist ?? res.data[0];
        if (!pick) return null;
        console.log(
          `[slux] Rescued "${track.title}" via SoundCloud: "${pick.info.title}" by ${pick.info.author}`,
        );
        return trackFromShoukaku(pick, {
          id: track.requesterId,
          tag: track.requesterTag,
          avatar: track.requesterAvatar,
        });
      }
      return null;
    } catch (err) {
      console.error(`[slux] SoundCloud rescue failed in ${this.guildId}:`, err);
      return null;
    }
  }

  private async playNext(): Promise<void> {
    const next = this.queue.shift();
    if (!next) {
      this.current = null;
      this.emit();
      this.startIdleTimer();
      return;
    }
    await this.playTrack(next);
  }

  private async playTrack(track: ResolvedTrack): Promise<void> {
    this.current = track;
    try {
      await this.player.playTrack({ track: { encoded: track.encoded } });
    } catch (err) {
      console.error(`[slux] playTrack failed in ${this.guildId}:`, err);
      await this.playNext();
    }
  }

  // ── Controls ─────────────────────────────────────────────────────

  async skip(): Promise<ResolvedTrack | null> {
    const skipped = this.current;
    await this.playNext();
    this.emit();
    return skipped;
  }

  async previous(): Promise<ResolvedTrack | null> {
    const prev = this.history[1] ?? this.history[0];
    if (!prev) return null;
    const toPlay = { ...prev, requesterId: this.current?.requesterId ?? prev.requesterId };
    if (this.current) this.queue.unshift(this.current);
    await this.playTrack(toPlay);
    this.emit();
    return toPlay;
  }

  async pause(): Promise<void> {
    if (this.player.paused) return;
    await this.player.setPaused(true);
    this.emit();
  }

  async resume(): Promise<void> {
    if (!this.player.paused) return;
    await this.player.setPaused(false);
    this.emit();
  }

  get paused(): boolean {
    return this.player.paused;
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0, Math.min(150, Math.round(volume)));
    await this.player.setGlobalVolume(this.volume);
    this.emit();
  }

  async seek(positionMs: number): Promise<boolean> {
    if (!this.current || !this.current.isSeekable) return false;
    const clamped = Math.max(0, Math.min(this.current.length, positionMs));
    await this.player.seekTo(clamped);
    this.emit();
    return true;
  }

  async setRepeat(mode: LoopMode): Promise<void> {
    this.repeat = mode;
    this.emit();
  }

  cycleRepeat(): LoopMode {
    const next: LoopMode = this.repeat === "off" ? "track" : this.repeat === "track" ? "queue" : "off";
    void this.setRepeat(next);
    return next;
  }

  toggleShuffle(): boolean {
    this.shuffle = !this.shuffle;
    if (this.shuffle) this.shuffleQueue();
    return this.shuffle;
  }

  shuffleQueue(): number {
    const count = this.queue.length;
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.emit();
    return count;
  }

  removeAt(index: number): ResolvedTrack | null {
    if (index < 1 || index > this.queue.length) return null;
    const [removed] = this.queue.splice(index - 1, 1);
    this.emit();
    return removed ?? null;
  }

  moveTrack(from: number, to: number): ResolvedTrack | null {
    if (from < 1 || from > this.queue.length || to < 1 || to > this.queue.length || from === to) return null;
    const [track] = this.queue.splice(from - 1, 1);
    if (!track) return null;
    this.queue.splice(to - 1, 0, track);
    this.emit();
    return track;
  }

  clearQueue(): number {
    const count = this.queue.length;
    this.queue = [];
    this.emit();
    return count;
  }

  /** Skip to a queue position (1-based), dropping everything before it.
   *  Returns the track jumped to, or null when the index is out of range. */
  skipTo(index: number): ResolvedTrack | null {
    if (index < 1 || index > this.queue.length) return null;
    const target = this.queue[index - 1];
    if (index > 1) this.queue.splice(0, index - 1);
    void this.skip();
    return target;
  }

  /** Drop duplicate tracks from the queue (by encoded id). Returns how many were removed. */
  removeDuplicates(): number {
    const seen = new Set<string>();
    const deduped = this.queue.filter((track) => {
      if (seen.has(track.encoded)) return false;
      seen.add(track.encoded);
      return true;
    });
    const removed = this.queue.length - deduped.length;
    if (removed > 0) {
      this.queue = deduped;
      this.emit();
    }
    return removed;
  }

  // ── Sleep timer ──────────────────────────────────────────────────

  private sleepTimer: NodeJS.Timeout | null = null;
  sleepTimerUntil: number | null = null;

  /** Pause playback after `minutes` (<= 0 cancels). Returns the deadline or null. */
  setSleepTimer(minutes: number): number | null {
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }
    if (!(minutes > 0)) {
      this.sleepTimerUntil = null;
      this.emit();
      return null;
    }
    const until = Date.now() + minutes * 60_000;
    this.sleepTimerUntil = until;
    this.sleepTimer = setTimeout(() => {
      this.sleepTimer = null;
      this.sleepTimerUntil = null;
      void this.pause().then(() => this.emit());
    }, minutes * 60_000);
    this.sleepTimer.unref?.();
    this.emit();
    return until;
  }

  // ── Filters ──────────────────────────────────────────────────────

  async applyFilter(name: string, value?: unknown): Promise<void> {
    this.activeFilters[name] = value === undefined ? true : value;
    await this.pushFilters();
  }

  async removeFilter(name: string): Promise<boolean> {
    if (!(name in this.activeFilters)) return false;
    delete this.activeFilters[name];
    await this.pushFilters();
    return true;
  }

  hasFilter(name: string): boolean {
    return name in this.activeFilters;
  }

  async resetFilters(): Promise<void> {
    this.activeFilters = {};
    await this.player.clearFilters();
    this.emit();
  }

  getFilterValue(name: string): unknown {
    return this.activeFilters[name];
  }

  private async pushFilters(): Promise<void> {
    const filters = buildFilters(this.activeFilters);
    await this.player.setFilters(filters);
    this.emit();
  }

  // ── Autoplay ─────────────────────────────────────────────────────

  private recentAutoplayKeys: string[] = [];

  private async fetchAutoplayTrack(): Promise<ResolvedTrack | null> {
    const seed = this.current ?? this.history[0] ?? this.queue[0];
    if (!seed) return null;
    try {
      const node = this.player.node;
      let tracks: Track[] = [];

      // Spotify seeds: LavaSrc recommendations mix
      if (seed.sourceName === "spotify" && seed.identifier) {
        const res = await node.rest.resolve(`sprec:mix:track:${seed.identifier}`);
        if (res?.loadType === "playlist") tracks = res.data.tracks;
      }
      // YouTube seeds: radio mix playlist (RD + video id)
      if (tracks.length === 0 && seed.sourceName === "youtube" && seed.identifier) {
        const res = await node.rest.resolve(
          `https://www.youtube.com/watch?v=${seed.identifier}&list=RD${seed.identifier}`,
        );
        if (res?.loadType === "playlist") tracks = res.data.tracks;
      }
      // Generic fallback: SoundCloud first (YouTube streams are commonly
      // login-walled on server IPs), YouTube as a secondary option.
      if (tracks.length === 0) {
        const scRes = await node.rest.resolve(`scsearch:${seed.author}`);
        if (scRes?.loadType === "search") tracks = scRes.data;
      }
      if (tracks.length === 0) {
        const query = seed.isrc ? `ytsearch:"${seed.isrc}"` : `ytsearch:${seed.author}`;
        const res = await node.rest.resolve(query);
        if (res?.loadType === "search") tracks = res.data;
      }

      const candidates = tracks.filter((t) => {
        const key = `${t.info.identifier}:${t.info.sourceName}`;
        return (
          !this.recentAutoplayKeys.includes(key) &&
          t.info.identifier !== seed.identifier &&
          t.info.title !== seed.title
        );
      });
      if (candidates.length === 0) return null;
      const pick = candidates[Math.floor(Math.random() * Math.min(8, candidates.length))];
      this.recentAutoplayKeys = [
        `${pick.info.identifier}:${pick.info.sourceName}`,
        ...this.recentAutoplayKeys,
      ].slice(0, 30);
      return trackFromShoukaku(pick);
    } catch (err) {
      console.error(`[slux] autoplay failed in ${this.guildId}:`, err);
      return null;
    }
  }

  // ── Voice / lifecycle ────────────────────────────────────────────

  get voiceChannel(): VoiceBasedChannel | null {
    const connection = this.client.shoukaku?.connections.get(this.guildId);
    if (!connection?.channelId) return null;
    const guild = this.client.guilds.cache.get(this.guildId);
    return (guild?.channels.cache.get(connection.channelId) as VoiceBasedChannel | undefined) ?? null;
  }

  listenerCount(): number {
    const channel = this.voiceChannel;
    if (!channel) return 0;
    return channel.members.filter((m) => !m.user.bot).size;
  }

  setIdleTimeout(minutes: number): void {
    this.idleTimeoutMinutes = minutes;
    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.idleTimeoutMinutes <= 0) return;
    if (!this.current || this.player.paused) {
      this.startIdleTimer();
    }
  }

  private startIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.idleTimeoutMinutes <= 0 || this.stayInChannel || this.queue.length > 0) return;
    if (this.current && !this.player.paused) return;
    this.idleTimer = setTimeout(
      () => {
        void this.leaveDueTo("idle");
      },
      this.idleTimeoutMinutes * 60 * 1000,
    );
    this.idleTimer.unref?.();
  }

  async leaveDueTo(reason: "idle" | "alone"): Promise<void> {
    const channel = this.textChannel;
    if (channel && "send" in channel && typeof channel.send === "function") {
      try {
        await this.refreshLocale();
        const { t } = this.localeContext();
        await channel.send({
          content: reason === "alone" ? t("music.leftAlone") : t("music.leftIdle"),
        });
      } catch {
        /* channel may be gone */
      }
    }
    await this.destroy(reason);
  }

  /** The bound text channel (set when a command first creates the player). */
  textChannel: TextBasedChannel | null = null;
  textChannelId: string | null = null;

  bindTextChannel(channel: TextBasedChannel): void {
    this.textChannel = channel;
    this.textChannelId = channel.id;
  }

  private localeContext(): { t: (key: string, vars?: Record<string, string | number>) => string; locale: string } {
    return {
      t: (key: string, vars?: Record<string, string | number>) => translate(this.effectiveLocale, key, vars),
      locale: this.effectiveLocale as string,
    };
  }

  private effectiveLocale: import("@/i18n").Locale = "en";

  async refreshLocale(): Promise<void> {
    try {
      const settings = await getGuildSettings(this.guildId);
      this.effectiveLocale = normalizeLocale(settings.language);
    } catch {
      this.effectiveLocale = "en";
    }
  }

  async destroy(reason: string): Promise<void> {
    if (this.destroyReason) return;
    this.destroyReason = reason;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.stopHeartbeat();
    this.queue = [];
    this.history = [];
    this.current = null;
    try {
      await this.player.destroy();
    } catch {
      /* node may be gone */
    }
    this.events.onDestroy?.(this.guildId, reason);
  }

  // ── Display helpers ──────────────────────────────────────────────

  get progressText(): string {
    if (!this.current) return "";
    if (this.current.isStream) return "LIVE";
    return `${formatDuration(this.player.position)} / ${formatDuration(this.current.length)}`;
  }
}
