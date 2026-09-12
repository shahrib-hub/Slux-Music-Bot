"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Settings,
  ListMusic,
  ChevronLeft,
  LogOut,
  Menu,
  X,
  Globe,
} from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useI18n } from "@/components/i18n-provider";
import { LOCALES } from "@/i18n";
import { cn } from "@/lib/utils";

export function DashboardShell({
  user,
  children,
}: {
  user: { username: string; avatar: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const guildId = pathname.match(/^\/dashboard\/(\d{17,20})/)?.[1];
  const isGuildScoped = !!guildId;

  const nav = [
    ...(isGuildScoped
      ? [
          { href: `/dashboard/${guildId}/player`, label: t("dashboard.nav.player"), icon: LayoutDashboard },
          { href: `/dashboard/${guildId}`, label: t("dashboard.nav.settings"), icon: Settings },
        ]
      : []),
    { href: "/dashboard/playlists", label: t("dashboard.nav.playlists"), icon: ListMusic },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Sluxlucent ambient backdrop */}
      <div className="sluxlucent-bg" aria-hidden />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col glass border-y-0 border-l-0 transition-transform md:translate-x-0 md:static",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo />
          </Link>
          <button className="md:hidden cursor-pointer" onClick={() => setMenuOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              pathname === "/dashboard"
                ? "bg-gradient-brand text-white font-medium"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <LayoutDashboard className="h-4 w-4" />
            {t("dashboard.nav.dashboard")}
          </Link>
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-gradient-brand text-white font-medium"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/commands"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("dashboard.nav.commands")}
          </Link>
        </nav>

        <div className="space-y-3 border-t border-border p-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2">
              <Globe className="h-4 w-4 text-primary shrink-0" />
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as typeof locale)}
                className="w-full bg-transparent text-sm outline-none cursor-pointer"
              >
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-popover text-popover-foreground">
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="h-8 w-8">
                {user.avatar && <AvatarImage src={user.avatar} alt={user.username} />}
                <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[11px] text-muted-foreground">
                  {t("dashboard.user.loggedInAs")}
                </p>
                <span className="block truncate text-sm font-medium leading-tight">
                  {user.username}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="iconSm" onClick={logout} title={t("dashboard.nav.logout")}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <p className="px-2 text-center text-[10px] text-muted-foreground">
            Made with ❤️ by SHM · @Letzforge
          </p>
        </div>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border px-4 md:hidden">
          <Button variant="ghost" size="iconSm" onClick={() => setMenuOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <BrandLogo size={26} />
        </div>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
