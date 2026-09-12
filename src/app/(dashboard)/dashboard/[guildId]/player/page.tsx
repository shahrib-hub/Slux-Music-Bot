"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Square,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  Search,
  ListMusic,
  Mic2,
  Trash2,
  ArrowUpToLine,
  Headphones,
  Radio,
  Disc3,
  Loader2,
  History as HistoryIcon,
  SlidersHorizontal,
  RotateCcw,
  ScrollText,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/i18n-provider";
import { usePlayerSocket, useProgress } from "@/hooks/use-player-socket";
import type { PlayerSnapshot, SearchResultEntry, LyricsResult } from "@/bot/music/types";
import { cn, formatDuration } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface GuildInfo {
  guild: { id: string; name: string; icon: string | null };
  voiceChannels: { id: string; name: string }[];
  snapshot: PlayerSnapshot | null;
}

const QUICK_FILTERS: { name: string; emoji: string }[] = [
  { name: "bassboost", emoji: "🔊" },
  { name: "nightcore", emoji: "🚀" },
  { name: "vaporwave", emoji: "🌴" },
  { name: "soft", emoji: "🕊️" },
  { name: "8d", emoji: "🌀" },
  { name: "karaoke", emoji: "🎤" },
  { name: "tremolo", emoji: "〰️" },
  { name: "vibrato", emoji: "🎚️" },
  { name: "distortion", emoji: "💥" },
  { name: "lowpass", emoji: "📉" },
];

type TabValue = "queue" | "lyrics" | "history" | "filters";

export default function PlayerPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { t } = useI18n();
  const { snapshot, connected, error: socketError, send } = usePlayerSocket(guildId);
  const progress = useProgress(snapshot);

  const [info, setInfo] = useState<GuildInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultEntry[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<TabValue>("queue");
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsKey, setLyricsKey] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [volumeLocal, setVolumeLocal] = useState<number | null>(null);
  const [seekLocal, setSeekLocal] = useState<number | null>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch(`/api/player/${guildId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: GuildInfo) => {
        setInfo({
          ...d,
          voiceChannels: Array.isArray(d.voiceChannels) ? d.voiceChannels : [],
        });
      })
      .catch(() => setLoadFailed(true));
  }, [guildId]);

  const currentTrack = snapshot?.track ?? null;
  const volume = volumeLocal ?? snapshot?.volume ?? 100;

  // Lyrics fetching — cached per track (title + author) so snapshots never
  // trigger refetches, with request cancellation for rapid track changes.
  const trackKey = currentTrack ? `${currentTrack.title}::${currentTrack.author}` : null;
  useEffect(() => {
    if (tab !== "lyrics" || !trackKey || lyricsKey === trackKey) return;
    const controller = new AbortController();
    setLyricsLoading(true);
    setLyrics(null);
    setLyricsKey(trackKey);
    apiFetch(`/api/lyrics/${guildId}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as { lyrics: LyricsResult | null };
      })
      .then((data) => setLyrics(data.lyrics ?? null))
      .catch(() => {})
      .finally(() => setLyricsLoading(false));
    return () => controller.abort();
  }, [tab, trackKey, guildId, lyricsKey]);

  const activeLyricIndex = useMemo(() => {
    if (!lyrics?.synced || !lyrics.lines.length) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].timestamp <= progress) idx = i;
      else break;
    }
    return idx;
  }, [lyrics, progress]);

  useEffect(() => {
    if (!autoScroll || activeLyricIndex < 0 || !lyricsRef.current) return;
    const el = lyricsRef.current.querySelector(`[data-index="${activeLyricIndex}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLyricIndex, autoScroll]);

  const doSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results: SearchResultEntry[] };
      setSearchResults(data.results);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSearching(false);
    }
  }, [searchQuery, t]);

  const play = useCallback(
    async (payload: Parameters<typeof send>[0]) => {
      const result = await send(payload);
      if (!result.ok && result.error) {
        toast.error(result.error);
      }
      return result;
    },
    [send],
  );

  const notConnected = info !== null && !snapshot?.connected;

  if (loadFailed) {
    return (
      <div className="glass mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl p-10 text-center">
        <Headphones className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t("dashboard.settings.notAvailable")}
        </p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const seekValue = seekLocal ?? Math.min(progress, currentTrack?.length ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Not connected state */}
      {notConnected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-10 text-center">
          <Headphones className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">{t("dashboard.player.notConnected")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.player.notConnectedDescription")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {info.voiceChannels.map((channel) => (
              <Button
                key={channel.id}
                variant="secondary"
                size="sm"
                onClick={() => play({ action: "join", value: channel.id })}
              >
                <Volume2 className="h-4 w-4" />
                {channel.name}
              </Button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Now playing */}
      {snapshot?.connected && (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTrack?.encoded ?? "idle"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass relative mb-6 overflow-hidden rounded-2xl"
          >
            {/* Ambient artwork backdrop */}
            {currentTrack?.artwork && (
              <div
                className="pointer-events-none absolute inset-0 opacity-25 blur-3xl saturate-150"
                style={{
                  backgroundImage: `url(${currentTrack.artwork})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}
            <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:p-8">
              {/* Artwork */}
              <div className="relative mx-auto shrink-0 md:mx-0">
                {currentTrack?.artwork ? (
                  <img
                    src={currentTrack.artwork}
                    alt=""
                    className="h-40 w-40 rounded-xl object-cover shadow-2xl shadow-primary/20 md:h-48 md:w-48"
                  />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-foreground/5 md:h-48 md:w-48">
                    <Disc3 className={cn("h-16 w-16 text-muted-foreground", currentTrack && "animate-spin-slow")} />
                  </div>
                )}
                {snapshot.playing && (
                  <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand shadow-lg">
                    <Radio className="h-4 w-4 text-white animate-pulse" />
                  </div>
                )}
              </div>

              {/* Track info + progress */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">
                  {t("dashboard.player.nowPlaying")}
                </p>
                <h2 className="mt-1 truncate text-2xl font-bold md:text-3xl">
                  {currentTrack ? (
                    currentTrack.uri ? (
                      <a href={currentTrack.uri} target="_blank" rel="noreferrer" className="hover:underline">
                        {currentTrack.title}
                      </a>
                    ) : (
                      currentTrack.title
                    )
                  ) : (
                    <span className="text-muted-foreground">{t("dashboard.player.nothingPlaying")}</span>
                  )}
                </h2>
                <p className="mt-0.5 truncate text-muted-foreground">
                  {currentTrack ? currentTrack.author : "—"}
                  {currentTrack && (
                    <span className="ml-3 inline-flex items-center gap-1.5 text-xs">
                      {currentTrack.requesterAvatar ? (
                        <img
                          src={currentTrack.requesterAvatar}
                          alt=""
                          className="h-4 w-4 rounded-full"
                        />
                      ) : null}
                      <span className="text-muted-foreground">
                        {t("dashboard.player.requestedBy")} <strong>{currentTrack.requesterTag}</strong>
                      </span>
                    </span>
                  )}
                  {snapshot.channelName && (
                    <span className="ml-3 inline-flex items-center gap-1 text-xs">
                      <Volume2 className="h-3 w-3" /> {t("dashboard.player.playingIn")} {snapshot.channelName}
                    </span>
                  )}
                </p>

                {/* Interactive seek bar */}
                {currentTrack && !currentTrack.isStream && (
                  <div className="mt-4">
                    <Slider
                      value={[Math.min(100, Math.max(0, (seekValue / currentTrack.length) * 100))]}
                      onValueChange={([v]) => setSeekLocal((v / 100) * currentTrack.length)}
                      onValueCommit={([v]) => {
                        void play({ action: "seek", value: Math.round((v / 100) * currentTrack.length) });
                        setSeekLocal(null);
                      }}
                      title={t("dashboard.player.seekHint")}
                    />
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>{formatDuration(seekValue)}</span>
                      <span>{formatDuration(currentTrack.length)}</span>
                    </div>
                  </div>
                )}
                {currentTrack?.isStream && (
                  <Badge variant="destructive" className="mt-3">
                    {t("dashboard.player.live")}
                  </Badge>
                )}

                {/* Controls */}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => play({ action: "previous" })}
                    disabled={!snapshot || (snapshot.history?.length ?? 0) === 0}
                    title={t("dashboard.player.previous")}
                  >
                    <SkipBack />
                  </Button>
                  <Button size="icon" className="h-12 w-12" onClick={() => play({ action: "toggle" })}>
                    {snapshot.paused ? <Play className="!size-5" /> : <Pause className="!size-5" />}
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => play({ action: "skip" })}
                    title={t("dashboard.player.skip")}
                  >
                    <SkipForward />
                  </Button>
                  <Button
                    variant={snapshot.repeat !== "off" ? "default" : "secondary"}
                    size="icon"
                    onClick={() =>
                      play({
                        action: "loop",
                        value:
                          snapshot.repeat === "off" ? "track" : snapshot.repeat === "track" ? "queue" : "off",
                      })
                    }
                    title={t("dashboard.player.loop")}
                  >
                    {snapshot.repeat === "track" ? <Repeat1 /> : <Repeat />}
                  </Button>
                  <Button
                    variant={snapshot.shuffle ? "default" : "secondary"}
                    size="icon"
                    onClick={() => play({ action: "shuffle" })}
                    title={t("dashboard.player.shuffle")}
                  >
                    <Shuffle />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:bg-red-500/10"
                    onClick={() => play({ action: "stop" })}
                    title={t("dashboard.player.stop")}
                  >
                    <Square />
                  </Button>

                  {/* Volume */}
                  <div className="ml-2 hidden items-center gap-2 sm:flex">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <Slider
                      className="w-28"
                      value={[volume]}
                      min={0}
                      max={150}
                      step={5}
                      onValueChange={([v]) => setVolumeLocal(v)}
                      onValueCommit={([v]) => {
                        void play({ action: "volume", value: v });
                        setVolumeLocal(null);
                      }}
                    />
                    <span className="w-10 text-xs text-muted-foreground">{volume}%</span>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex shrink-0 flex-col gap-3 border-t border-border pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{t("dashboard.player.autoplay")}</span>
                  <Switch checked={snapshot.autoplay} onCheckedChange={() => play({ action: "autoplay" })} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">24/7</span>
                  <Switch checked={snapshot.stayInChannel} onCheckedChange={() => play({ action: "247" })} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">DJ mode</span>
                  <Switch checked={snapshot.djMode} onCheckedChange={() => play({ action: "djmode" })} />
                </label>
                {snapshot.filters.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {snapshot.filters.map((f) => (
                      <Badge key={f} variant="secondary" className="text-[10px]">
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Search bar */}
      {snapshot?.connected && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder={t("dashboard.player.searchPlaceholder")}
            className="pl-9 pr-24"
          />
          <Button size="sm" className="absolute right-1.5 top-1/2 -translate-y-1/2" onClick={doSearch} disabled={searching}>
            {searching ? <Loader2 className="animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {t("dashboard.player.play")}
          </Button>

          {searchResults && (
            <div className="glass absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-xl p-2 shadow-2xl">
              {searchResults.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">{t("common.nothingFound")}</p>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.encoded}
                    onClick={() => {
                      void play({ action: "play", track: { encoded: result.encoded } });
                      setSearchResults(null);
                      setSearchQuery("");
                      toast.success(t("dashboard.player.added"));
                    }}
                    className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-foreground/5 cursor-pointer"
                  >
                    {result.artwork ? (
                      <img src={result.artwork} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-foreground/5">
                        <Disc3 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{result.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{result.author}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {result.isStream ? "LIVE" : formatDuration(result.length)}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Realtime status — shows WHY the socket is down, not just that it is */}
      {info && !connected && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-500">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>{t("dashboard.player.realtimeOff")}</span>
          {socketError && <span className="text-xs opacity-75">— {socketError}</span>}
        </div>
      )}

      {/* Queue / Lyrics / History / Filters tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="queue">
            <ListMusic className="h-4 w-4" />
            {t("dashboard.player.queue")} ({snapshot?.queue.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="lyrics">
            <Mic2 className="h-4 w-4" />
            {t("dashboard.player.lyrics")}
          </TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="h-4 w-4" />
            {t("dashboard.player.history")} ({snapshot?.history.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="filters">
            <SlidersHorizontal className="h-4 w-4" />
            {t("dashboard.player.filtersTab")}
          </TabsTrigger>
        </TabsList>

        {tab === "queue" && (
          <div className="glass mt-4 rounded-xl">
            {snapshot && snapshot.queue.length > 0 && (
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm text-muted-foreground">
                  {snapshot.queue.length} {t("common.tracks")}
                </span>
                <Button variant="ghost" size="sm" onClick={() => play({ action: "clear" })}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("dashboard.player.clear")}
                </Button>
              </div>
            )}
            {!snapshot || snapshot.queue.length === 0 ? (
              <p className="p-10 text-center text-muted-foreground">{t("dashboard.player.queueEmpty")}</p>
            ) : (
              <div className="max-h-[480px] overflow-auto p-2">
                {snapshot.queue.map((track, index) => (
                  <QueueRow
                    key={`${track.encoded}-${index}`}
                    index={index}
                    track={track}
                    disabled={!connected}
                    onRemove={() => play({ action: "remove", value: index + 1 })}
                    onMoveTop={() => play({ action: "moveTop", value: index + 1 })}
                    onMove={(to) => play({ action: "move", value: { from: index + 1, to } })}
                    total={snapshot.queue.length}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "lyrics" && (
          <div className="glass mt-4 rounded-xl p-6">
            {/* Lyrics header */}
            {currentTrack && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  {currentTrack.artwork ? (
                    <img src={currentTrack.artwork} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-foreground/5">
                      <Mic2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{currentTrack.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {currentTrack.author}
                      {lyrics && (
                        <>
                          {" • "}
                          {lyrics.synced
                            ? `🎙️ ${t("dashboard.player.lyricsSynced")}`
                            : `📄 ${t("dashboard.player.lyricsPlain")}`}
                          {lyrics.source ? ` • ${lyrics.source}` : ""}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {lyrics?.synced && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ScrollText className="h-3.5 w-3.5" />
                    {t("dashboard.player.autoScroll")}
                    <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
                  </label>
                )}
              </div>
            )}

            {lyricsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !lyrics || (!lyrics.lines.length && !lyrics.text) ? (
              <p className="py-10 text-center text-muted-foreground">{t("dashboard.player.noLyrics")}</p>
            ) : lyrics.synced && lyrics.lines.length > 0 ? (
              <div className="max-h-[480px] space-y-3 overflow-auto py-4" ref={lyricsRef}>
                {lyrics.lines.map((line, i) => (
                  <p
                    key={i}
                    data-index={i}
                    data-active={i === activeLyricIndex}
                    className="lyrics-line px-2 text-center text-lg"
                  >
                    {line.line || "♪"}
                  </p>
                ))}
              </div>
            ) : (
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap text-center font-sans text-base leading-relaxed">
                {lyrics.text}
              </pre>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="glass mt-4 rounded-xl">
            {!snapshot || snapshot.history.length === 0 ? (
              <p className="p-10 text-center text-muted-foreground">{t("dashboard.player.historyEmpty")}</p>
            ) : (
              <div className="max-h-[480px] overflow-auto p-2">
                {snapshot.history.map((track, index) => (
                  <div
                    key={`${track.encoded}-${index}`}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-foreground/5",
                      index === 0 && "bg-primary/5",
                    )}
                  >
                    <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{index + 1}</span>
                    {track.artwork ? (
                      <img src={track.artwork} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-foreground/5">
                        <Disc3 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {track.title}
                        {index === 0 && <span className="ml-2 text-[10px] uppercase text-primary">now</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {track.author}
                        {track.fromAutoplay && " · ✨"}
                        <span className="ml-2 inline-flex items-center gap-1">
                          {track.requesterAvatar ? (
                            <img src={track.requesterAvatar} alt="" className="h-3.5 w-3.5 rounded-full" />
                          ) : null}
                          {track.requesterTag}
                        </span>
                      </p>
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {track.isStream ? "LIVE" : formatDuration(track.length)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                      disabled={!connected}
                      onClick={() => {
                        void play({ action: "play", track: { encoded: track.encoded } });
                        toast.success(t("dashboard.player.added"));
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {t("dashboard.player.replay")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "filters" && (
          <div className="glass mt-4 rounded-xl p-6">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                {snapshot?.filters.length
                  ? `${snapshot.filters.length} ${t("dashboard.player.filtersTab").toLowerCase()}`
                  : t("dashboard.player.filtersNone")}
              </div>
              {snapshot && snapshot.filters.length > 0 && (
                <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10" onClick={() => play({ action: "resetFilters" })}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("dashboard.player.filtersReset")}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {QUICK_FILTERS.map((filter) => {
                const active = snapshot?.filters.includes(filter.name) ?? false;
                return (
                  <button
                    key={filter.name}
                    disabled={!connected || !snapshot?.connected}
                    onClick={() =>
                      play({
                        action: "filter",
                        value: { name: filter.name, on: !active },
                      })
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-all hover:border-primary/50",
                      active
                        ? "bg-primary/15 border-primary/50 text-foreground shadow-sm shadow-primary/10"
                        : "bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/5",
                      (!connected || !snapshot?.connected) && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="text-base">{filter.emoji}</span>
                    <span className="flex-1 text-left capitalize">{filter.name}</span>
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        active ? "bg-green-400 shadow-[0_0_6px] shadow-green-400/50" : "bg-muted-foreground/30",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
}

function QueueRow({
  index,
  track,
  disabled,
  onRemove,
  onMoveTop,
  onMove,
  total,
}: {
  index: number;
  track: PlayerSnapshot["queue"][number];
  disabled: boolean;
  onRemove: () => void;
  onMoveTop: () => void;
  onMove: (to: number) => void;
  total: number;
}) {
  const { t } = useI18n();
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index + 1))}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (Number.isFinite(from) && from !== index + 1) onMove(index + 1);
      }}
      className={cn(
        "group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-foreground/5",
        dragOver && "border-t-2 border-primary",
      )}
    >
      <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{index + 1}</span>
      {track.artwork ? (
        <img src={track.artwork} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-foreground/5">
          <Disc3 className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {track.author}
          {track.fromAutoplay && " · ✨"}
          <span className="ml-2 inline-flex items-center gap-1">
            {track.requesterAvatar ? (
              <img src={track.requesterAvatar} alt="" className="h-3.5 w-3.5 rounded-full" />
            ) : null}
            {track.requesterTag}
          </span>
        </p>
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        {track.isStream ? t("dashboard.player.live") : formatDuration(track.length)}
      </span>
      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="iconSm" disabled={disabled || index === 0} onClick={onMoveTop} title="Top">
          <ArrowUpToLine className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="iconSm" disabled={disabled || index === total - 1} onClick={() => onMove(index + 2)} title="↓">
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="iconSm"
          className="text-red-400 hover:bg-red-500/10"
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
