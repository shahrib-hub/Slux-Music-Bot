"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { LOCALES } from "@/i18n";

interface GuildSettingsData {
  settings: {
    prefix: string;
    language: string;
    djRoles: string[];
    botChannels: string[];
    defaultVolume: number;
    defaultAutoplay: boolean;
    default247: boolean;
    idleTimeout: number;
  };
  guild: {
    id: string;
    name: string;
    icon: string | null;
    roles: { id: string; name: string; color: string }[];
    textChannels: { id: string; name: string }[];
  };
}

export default function GuildSettingsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { t } = useI18n();
  const [data, setData] = useState<GuildSettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<GuildSettingsData["settings"] | null>(null);

  useEffect(() => {
    fetch(`/api/guilds/${guildId}/settings`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: GuildSettingsData) => {
        setData(d);
        setDraft(d.settings);
      })
      .catch(() => setError("failed"));
  }, [guildId]);

  const patch = useCallback(
    async (partial: Partial<GuildSettingsData["settings"]>) => {
      if (!draft) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/guilds/${guildId}/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partial),
        });
        if (!res.ok) throw new Error();
        const updated = (await res.json()).settings;
        setDraft(updated);
        toast.success(t("dashboard.settings.saved"));
      } catch {
        toast.error(t("dashboard.settings.saveFailed"));
      } finally {
        setSaving(false);
      }
    },
    [draft, guildId, t],
  );

  if (error) {
    return (
      <div className="glass mx-auto max-w-2xl rounded-xl p-10 text-center text-muted-foreground">
        {t("dashboard.settings.notAvailable")}
      </div>
    );
  }

  if (!data || !draft) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {data.guild.icon ? (
            <img src={data.guild.icon} alt="" className="h-10 w-10 rounded-lg" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand font-bold text-white">
              {data.guild.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{data.guild.name}</h1>
            <p className="text-sm text-muted-foreground">{t("dashboard.settings.title")}</p>
          </div>
        </div>
        {dirty && (
          <Button onClick={() => patch(draft)} disabled={saving}>
            <Save className="h-4 w-4" />
            {t("dashboard.settings.save")}
          </Button>
        )}
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">{t("dashboard.settings.general")}</TabsTrigger>
          <TabsTrigger value="playback">{t("dashboard.settings.playback")}</TabsTrigger>
          <TabsTrigger value="dj">{t("dashboard.settings.dj")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="glass space-y-6 rounded-xl p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">{t("dashboard.settings.prefix")}</label>
                <Input
                  value={draft.prefix}
                  maxLength={5}
                  onChange={(e) => setDraft({ ...draft, prefix: e.target.value })}
                  className="font-mono"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{t("dashboard.settings.prefixDescription")}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">{t("dashboard.settings.language")}</label>
                <select
                  value={draft.language}
                  onChange={(e) => setDraft({ ...draft, language: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-foreground/5 px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
                >
                  {LOCALES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-popover">
                      {l.flag} {l.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-muted-foreground">{t("dashboard.settings.languageDescription")}</p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {t("dashboard.settings.botChannels")} —{" "}
                <span className="text-muted-foreground">
                  {draft.botChannels.length === 0
                    ? t("dashboard.settings.allChannels")
                    : `${draft.botChannels.length}`}
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {data.guild.textChannels.map((channel) => {
                  const active = draft.botChannels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          botChannels: active
                            ? draft.botChannels.filter((c) => c !== channel.id)
                            : [...draft.botChannels, channel.id],
                        })
                      }
                      className={`rounded-full border px-3 py-1 text-sm transition-all cursor-pointer ${
                        active
                          ? "border-transparent bg-gradient-brand text-white"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      # {channel.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{t("dashboard.settings.botChannelsDescription")}</p>
            </div>

            <div className="flex justify-end gap-2">
              {dirty && (
                <Button variant="ghost" onClick={() => setDraft(data.settings)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={() => patch(draft)} disabled={saving}>
                <Save className="h-4 w-4" />
                {t("dashboard.settings.save")}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="playback">
          <div className="glass space-y-8 rounded-xl p-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium">{t("dashboard.settings.defaultVolume")}</label>
                <span className="rounded bg-primary/15 px-2 py-0.5 text-sm font-bold text-primary">
                  {draft.defaultVolume}%
                </span>
              </div>
              <Slider
                value={[draft.defaultVolume]}
                min={0}
                max={150}
                step={5}
                onValueChange={([v]) => setDraft({ ...draft, defaultVolume: v })}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">{t("dashboard.settings.defaultVolumeDescription")}</p>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium">{t("dashboard.settings.idleTimeout")}</label>
                <span className="rounded bg-primary/15 px-2 py-0.5 text-sm font-bold text-primary">
                  {draft.idleTimeout === 0 ? "∞" : `${draft.idleTimeout}m`}
                </span>
              </div>
              <Slider
                value={[draft.idleTimeout]}
                min={0}
                max={60}
                step={5}
                onValueChange={([v]) => setDraft({ ...draft, idleTimeout: v })}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">{t("dashboard.settings.idleTimeoutDescription")}</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium">{t("dashboard.settings.autoplay")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.autoplayDescription")}</p>
              </div>
              <Switch
                checked={draft.defaultAutoplay}
                onCheckedChange={(v) => setDraft({ ...draft, defaultAutoplay: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium">{t("dashboard.settings.stay247")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.stay247Description")}</p>
              </div>
              <Switch checked={draft.default247} onCheckedChange={(v) => setDraft({ ...draft, default247: v })} />
            </div>

            <div className="flex justify-end gap-2">
              {dirty && (
                <Button variant="ghost" onClick={() => setDraft(data.settings)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={() => patch(draft)} disabled={saving}>
                <Save className="h-4 w-4" />
                {t("dashboard.settings.save")}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dj">
          <div className="glass rounded-xl p-6">
            <label className="mb-1 block text-sm font-medium">{t("dashboard.settings.djRoles")}</label>
            <p className="mb-4 text-xs text-muted-foreground">{t("dashboard.settings.djRolesDescription")}</p>
            <div className="flex flex-wrap gap-2">
              {data.guild.roles.map((role) => {
                const active = draft.djRoles.includes(role.id);
                return (
                  <button
                    key={role.id}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        djRoles: active
                          ? draft.djRoles.filter((r) => r !== role.id)
                          : [...draft.djRoles, role.id],
                      })
                    }
                    className={`rounded-full border px-3 py-1 text-sm transition-all cursor-pointer ${
                      active
                        ? "border-transparent bg-gradient-brand text-white"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                    style={!active && role.color !== "#99AAB5" ? { color: role.color } : undefined}
                  >
                    {role.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              {dirty && (
                <Button variant="ghost" onClick={() => setDraft(data.settings)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={() => patch(draft)} disabled={saving}>
                <Save className="h-4 w-4" />
                {t("dashboard.settings.save")}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
