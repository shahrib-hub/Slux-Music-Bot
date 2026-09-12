"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Terminal, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import type { CommandCatalogEntry } from "@/lib/command-catalog";

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  music: { icon: "🎵", color: "from-violet-500 to-purple-500" },
  playlists: { icon: "📁", color: "from-blue-500 to-cyan-500" },
  filters: { icon: "🎛️", color: "from-fuchsia-500 to-pink-500" },
  settings: { icon: "⚙️", color: "from-slate-400 to-slate-500" },
  info: { icon: "ℹ️", color: "from-emerald-400 to-teal-500" },
};

export function CommandsView({ commands }: { commands: CommandCatalogEntry[] }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => ["all", ...new Set(commands.map((c) => c.category))], [commands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.aliases.some((a) => a.toLowerCase().includes(q)) ||
        t(c.descriptionKey).toLowerCase().includes(q)
      );
    });
  }, [commands, query, category, t]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandCatalogEntry[]>();
    for (const cmd of filtered) {
      const list = map.get(cmd.category) ?? [];
      list.push(cmd);
      map.set(cmd.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold">
          <span className="text-gradient">{t("dashboard.commands.title")}</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t("dashboard.commands.subtitle", { count: commands.length })}
        </p>
      </div>

      <div className="mb-8 flex flex-col items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dashboard.commands.search")}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-all cursor-pointer ${
                category === cat
                  ? "border-transparent bg-gradient-brand text-white"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {cat === "all" ? (
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  {t("info.helpTitle").split("—")[0]?.trim() || "All"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  {CATEGORY_META[cat]?.icon} {t(`info.helpFields.${cat}`)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("dashboard.commands.noResults")}</p>
      ) : (
        <AnimatePresence mode="popLayout">
          {[...grouped.entries()].map(([cat, cmds]) => (
            <motion.section
              key={cat}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-10"
            >
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <span className={`inline-block h-6 w-1 rounded-full bg-gradient-to-r ${CATEGORY_META[cat]?.color ?? ""}`} />
                {CATEGORY_META[cat]?.icon} {t(`info.helpFields.${cat}`)}
                <span className="text-sm font-normal text-muted-foreground">({cmds.length})</span>
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {cmds.map((cmd) => (
                  <motion.div
                    key={cmd.name}
                    layout
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass rounded-lg p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-primary/15 px-2 py-0.5 text-sm font-bold text-primary">
                          /{cmd.name}
                        </code>
                        <span className="text-xs text-muted-foreground">
                          <Terminal className="mr-0.5 inline h-3 w-3" />
                          {cmd.name}
                        </span>
                      </div>
                      {cmd.aliases.length > 0 && (
                        <div className="hidden gap-1 sm:flex">
                          {cmd.aliases.slice(0, 3).map((alias) => (
                            <Badge key={alias} variant="secondary" className="text-[10px]">
                              {alias}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{t(cmd.descriptionKey)}</p>
                    <p className="mt-2 text-xs text-muted-foreground/70">
                      {t("dashboard.commands.usage")}:{" "}
                      <code className="text-foreground/80">
                        /{cmd.name} {cmd.usage !== cmd.name ? cmd.usage : ""}
                      </code>
                      {cmd.aliases.length > 0 && (
                        <span className="ml-2">
                          · <code className="text-foreground/80">!{cmd.name}</code>
                        </span>
                      )}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground/60">
        Locale: {locale} — strings shown in your selected language where available.
      </p>
    </div>
  );
}
