"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  LayoutDashboard,
  Music4,
  SlidersHorizontal,
  ListMusic,
  Mic2,
  Infinity as InfinityIcon,
  Languages,
  Youtube,
  Users,
  Bot,
  AudioLines,
  LogIn,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EqualizerBars } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { apiFetch, apiUrl } from "@/lib/api";

export function LandingView({ inviteUrl }: { inviteUrl: string }) {
  const { t } = useI18n();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "login") setShowLogin(true);
  }, []);

  const features = [
    { icon: Music4, title: t("dashboard.landing.sourcesTitle"), description: t("dashboard.landing.sourcesDescription") },
    { icon: SlidersHorizontal, title: t("dashboard.landing.filtersTitle"), description: t("dashboard.landing.filtersDescription") },
    { icon: ListMusic, title: t("dashboard.landing.playlistsTitle"), description: t("dashboard.landing.playlistsDescription") },
    { icon: Mic2, title: t("dashboard.landing.lyricsTitle"), description: t("dashboard.landing.lyricsDescription") },
    { icon: LayoutDashboard, title: t("dashboard.landing.dashboardTitle"), description: t("dashboard.landing.dashboardDescription") },
    { icon: InfinityIcon, title: t("dashboard.landing.autoplayTitle"), description: t("dashboard.landing.autoplayDescription") },
  ];

  return (
    <div>
      <AnimatePresence>
        {showLogin && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-16 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-primary/40 bg-popover p-4 shadow-2xl"
          >
            <LogIn className="h-5 w-5 shrink-0 text-primary" />
            <p className="flex-1 text-sm">
              <span className="font-semibold">{t("dashboard.auth.loginRequired")}</span>
              <span className="text-muted-foreground"> — {t("dashboard.auth.loginRequiredDescription")}</span>
            </p>
            <Button size="sm" asChild>
              <a href={apiUrl("/api/auth/login")}>{t("dashboard.auth.login")}</a>
            </Button>
            <button onClick={() => setShowLogin(false)} className="cursor-pointer">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <section className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pb-20 pt-24 text-center md:pt-32">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
            <EqualizerBars className="mr-2 h-3" bars={3} />
            {t("dashboard.landing.badge")}
          </Badge>
          <h1 className="mx-auto max-w-4xl text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
            <span className="text-gradient">{t("dashboard.landing.title")}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{t("dashboard.landing.subtitle")}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="min-w-48">
              <a href={inviteUrl} target="_blank" rel="noreferrer">
                <Play className="mr-1" />
                {t("dashboard.landing.addDiscord")}
              </a>
            </Button>
            <Button size="lg" variant="secondary" asChild className="min-w-48">
              <Link href="/dashboard">
                <LayoutDashboard className="mr-1" />
                {t("dashboard.landing.openDashboard")}
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              <a href="https://youtube.com/@Letzforge" target="_blank" rel="noreferrer">
                <Youtube className="mr-1" />
                Support me on YouTube
              </a>
            </Button>
          </div>
        </motion.div>

        {/* Source badges */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground"
        >
          {[
            { icon: AudioLines, label: "Spotify" },
            { icon: Youtube, label: "YouTube" },
            { icon: AudioLines, label: "SoundCloud" },
            { icon: Music4, label: "Deezer" },
            { icon: Music4, label: "Apple Music" },
            { icon: Music4, label: "Tidal" },
            { icon: Music4, label: "YouTube Music" },
          ].map((source) => (
            <span
              key={source.label}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-foreground/[0.03] px-4 py-1.5"
            >
              <source.icon className="h-4 w-4 text-primary" />
              {source.label}
            </span>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">{t("dashboard.landing.featuresTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("dashboard.landing.featuresSubtitle")}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="glass group rounded-xl p-6 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary/15 p-3 text-primary transition-transform group-hover:scale-110">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Language strip */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="glass flex flex-col items-center justify-between gap-6 rounded-xl p-8 md:flex-row">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/15 p-3 text-primary">
              <Languages className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{t("dashboard.landing.i18nTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("dashboard.landing.i18nDescription")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["🇬🇧 English", "🇮🇳 हिन्दी", "🇪🇸 Español", "🇫🇷 Français", "🇩🇪 Deutsch", "🇧🇷 Português"].map((l) => (
              <Badge key={l} variant="secondary" className="px-3 py-1">
                {l}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-10 text-center text-white md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
          <Bot className="mx-auto mb-6 h-12 w-12 opacity-90" />
          <h2 className="text-3xl font-bold md:text-4xl">{t("dashboard.landing.ctaTitle")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">{t("dashboard.landing.ctaSubtitle")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" variant="secondary" asChild>
              <a href={inviteUrl} target="_blank" rel="noreferrer">
                <Play className="mr-1" />
                {t("dashboard.landing.addDiscord")}
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              <Link href="/dashboard">{t("dashboard.landing.openDashboard")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <LiveStats />
      </section>
    </div>
  );
}

function LiveStats() {
  const { t } = useI18n();
  const [stats, setStats] = useState<{ servers: number; players: number; commands: number } | null>(null);

  useEffect(() => {
    apiFetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const items = [
    { icon: Users, value: stats?.servers ?? "—", label: t("dashboard.landing.statsServers") },
    { icon: Bot, value: stats?.players ?? "—", label: t("dashboard.landing.statsPlayers") },
    { icon: Music4, value: stats?.commands ?? "—", label: "commands" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="glass rounded-xl p-6 text-center">
          <item.icon className="mx-auto mb-2 h-5 w-5 text-primary" />
          <div className="text-3xl font-bold">{item.value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
