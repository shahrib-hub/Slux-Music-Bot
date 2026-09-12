"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Settings as SettingsIcon, Server, TriangleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { SessionExpiredCard } from "@/components/session-expired-card";
import { apiFetch } from "@/lib/api";

interface DashboardGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number | null;
  botPresent: boolean;
}

type LoadState = "loading" | "ready" | "expired" | "error";

export default function DashboardHome() {
  const { t } = useI18n();
  const [guilds, setGuilds] = useState<DashboardGuild[]>([]);
  const [inviteUrl, setInviteUrl] = useState("");
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(() => {
    setState("loading");
    apiFetch("/api/guilds")
      .then(async (r) => {
        if (r.status === 401) {
          setState("expired");
          return null;
        }
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data: { guilds?: DashboardGuild[]; inviteUrl?: string } | null) => {
        if (!data) return;
        setGuilds(Array.isArray(data.guilds) ? data.guilds : []);
        setInviteUrl(data.inviteUrl ?? "");
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("dashboard.guilds.title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("dashboard.guilds.subtitle")}</p>
      </div>

      {state === "expired" ? (
        <SessionExpiredCard />
      ) : state === "error" ? (
        <div className="glass mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl p-10 text-center">
          <TriangleAlert className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">{t("common.error")}</p>
          <Button variant="secondary" onClick={load}>
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : state === "loading" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : guilds.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-xl p-16 text-center">
          <Server className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">{t("dashboard.guilds.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guilds.map((guild, i) => (
            <motion.div
              key={guild.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="glass group rounded-xl p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="mb-4 flex items-center gap-3">
                {guild.icon ? (
                  <img src={guild.icon} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-lg font-bold text-white">
                    {guild.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{guild.name}</h3>
                  {guild.memberCount && (
                    <p className="text-xs text-muted-foreground">
                      {guild.memberCount.toLocaleString()} members
                    </p>
                  )}
                </div>
              </div>
              {guild.botPresent ? (
                <div className="flex items-center justify-between">
                  <Badge variant="success">
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Online
                  </Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/dashboard/${guild.id}/player`}>{t("dashboard.guilds.manage")}</Link>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/dashboard/${guild.id}`}>
                        <SettingsIcon className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <Badge variant="destructive">Not installed</Badge>
                  <Button size="sm" asChild>
                    <a href={inviteUrl} target="_blank" rel="noreferrer">
                      <Plus className="h-4 w-4" />
                      {t("dashboard.guilds.invite")}
                    </a>
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
