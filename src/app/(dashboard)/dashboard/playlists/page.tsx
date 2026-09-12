"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ListMusic, Globe, Lock, Play, Disc3, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";
import { formatDuration, cn } from "@/lib/utils";
import { apiFetch, socketOptions, socketUrl } from "@/lib/api";

interface PlaylistTrackDoc {
  encoded: string;
  title: string;
  author: string;
  length: number;
  uri: string;
  artwork: string;
  sourceName: string;
}

interface PlaylistEntry {
  id: string;
  name: string;
  description: string;
  trackCount: number;
  public: boolean;
  tracks: PlaylistTrackDoc[];
}

interface DashboardGuildLite {
  id: string;
  name: string;
  botPresent: boolean;
}

export default function PlaylistsPage() {
  const { t } = useI18n();
  const [playlists, setPlaylists] = useState<PlaylistEntry[] | null>(null);
  const [guilds, setGuilds] = useState<DashboardGuildLite[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [playTarget, setPlayTarget] = useState<PlaylistEntry | null>(null);

  const load = useCallback(() => {
    apiFetch("/api/playlists")
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { playlists?: PlaylistEntry[] }) => {
        setPlaylists(Array.isArray(d.playlists) ? d.playlists : []);
      })
      .catch(() => setPlaylists([]));
  }, []);

  useEffect(() => {
    load();
    apiFetch("/api/guilds")
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { guilds?: DashboardGuildLite[] }) => {
        const playable = Array.isArray(d.guilds) ? d.guilds.filter((g) => g.botPresent) : [];
        setGuilds(playable);
      })
      .catch(() => {});
  }, [load]);

  async function createPlaylist() {
    const name = newName.trim();
    if (!name) return;
    const res = await apiFetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: newDescription.trim() }),
    });
    if (res.ok) {
      toast.success(t("dashboard.playlists.created"));
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error === "playlist exists" ? t("playlists.exists", { name }) : t("common.error"));
    }
  }

  async function deletePlaylist(playlist: PlaylistEntry) {
    if (!confirm(t("dashboard.playlists.deleteConfirm", { name: playlist.name }))) return;
    const res = await apiFetch(`/api/playlists/${playlist.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("dashboard.playlists.deleted"));
      load();
    }
  }

  async function togglePublic(playlist: PlaylistEntry) {
    await apiFetch(`/api/playlists/${playlist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public: !playlist.public }),
    });
    load();
  }

  async function removeTrack(playlist: PlaylistEntry, index: number) {
    await apiFetch(`/api/playlists/${playlist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeTrackIndex: index }),
    });
    load();
  }

  async function playInGuild(playlist: PlaylistEntry, guildId: string) {
    const socket = await import("socket.io-client").then((m) =>
      m.io(socketUrl() + "/dashboard", socketOptions),
    );
    socket.on("connect", () => {
      socket.emit("player:action", { guildId, action: "join" }, () => {
        // Queue all tracks sequentially via REST-ish socket calls
        void (async () => {
          for (const track of playlist.tracks) {
            await new Promise<void>((resolve) => {
              socket.emit(
                "player:action",
                { guildId, action: "play", track: { encoded: track.encoded } },
                () => resolve(),
              );
            });
          }
          socket.disconnect();
          toast.success(t("playlists.loaded", { count: playlist.tracks.length, name: playlist.name }));
          setPlayTarget(null);
        })();
      });
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("dashboard.playlists.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("dashboard.playlists.subtitle")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("dashboard.playlists.create")}
        </Button>
      </div>

      {playlists === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-xl p-16 text-center">
          <ListMusic className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">{t("dashboard.playlists.empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {playlists.map((playlist) => (
              <motion.div
                key={playlist.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl"
              >
                <div className="flex flex-wrap items-center gap-4 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand/20 text-primary">
                    <ListMusic className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold">{playlist.name}</h3>
                      <Badge variant={playlist.public ? "success" : "secondary"}>
                        {playlist.public ? (
                          <>
                            <Globe className="mr-1 h-3 w-3" />
                            {t("dashboard.playlists.public")}
                          </>
                        ) : (
                          <>
                            <Lock className="mr-1 h-3 w-3" />
                            {t("dashboard.playlists.private")}
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {playlist.description || `${playlist.trackCount} ${t("dashboard.playlists.tracks")}`}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch checked={playlist.public} onCheckedChange={() => togglePublic(playlist)} />
                  </label>
                  <Button variant="secondary" size="sm" onClick={() => playTarget?.id === playlist.id ? setPlayTarget(null) : setPlayTarget(playlist)}>
                    <Play className="h-3.5 w-3.5" />
                    {t("dashboard.playlists.loadToGuild")}
                  </Button>
                  <Button variant="ghost" size="iconSm" onClick={() => setExpanded(expanded === playlist.id ? null : playlist.id)}>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", expanded === playlist.id && "rotate-180")} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    className="text-red-400 hover:bg-red-500/10"
                    onClick={() => deletePlaylist(playlist)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {playTarget?.id === playlist.id && guilds.length > 0 && (
                  <div className="border-t border-border px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {guilds.map((guild) => (
                        <Button key={guild.id} size="sm" variant="secondary" onClick={() => playInGuild(playlist, guild.id)}>
                          {guild.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {expanded === playlist.id && (
                  <div className="border-t border-border p-2">
                    {playlist.tracks.length === 0 ? (
                      <p className="p-6 text-center text-sm text-muted-foreground">
                        {t("dashboard.playlists.emptyPlaylist")}
                      </p>
                    ) : (
                      playlist.tracks.map((track, i) => (
                        <div key={`${track.encoded}-${i}`} className="group flex items-center gap-3 rounded-lg p-2.5 hover:bg-foreground/5">
                          <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                          {track.artwork ? (
                            <img src={track.artwork} alt="" className="h-9 w-9 rounded object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded bg-foreground/5">
                              <Disc3 className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{track.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{track.author}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDuration(track.length)}</span>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            className="text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10"
                            onClick={() => removeTrack(playlist, i + 1)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.playlists.createTitle")}</DialogTitle>
            <DialogDescription>{t("dashboard.playlists.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("dashboard.playlists.namePlaceholder")}
              maxLength={64}
              autoFocus
            />
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={t("dashboard.playlists.descriptionPlaceholder")}
              maxLength={256}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {t("music.cancelButton")}
            </Button>
            <Button onClick={createPlaylist} disabled={!newName.trim()}>
              {t("dashboard.playlists.createCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
