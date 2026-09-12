import Link from "next/link";
import { Youtube, MessageCircle } from "lucide-react";
import { BrandLogo, EqualizerBars } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getEnv } from "@/lib/env";
import { inviteUrl } from "@/lib/invite";

export const dynamic = "force-dynamic";

export const YOUTUBE_URL = "https://youtube.com/@Letzforge";
export const DISCORD_SERVER_URL = "https://discord.gg/NC4YdDQj5u";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const invite = inviteUrl(getEnv().DISCORD_CLIENT_ID);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* Sluxlucent ambient backdrop */}
      <div className="sluxlucent-bg" aria-hidden />

      <header className="sticky top-0 z-40 glass border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo />
            <EqualizerBars className="ml-1 opacity-80" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link href="/commands" className="transition-colors hover:text-foreground">
              Commands
            </Link>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a
              href={YOUTUBE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Youtube className="h-4 w-4 text-red-500" />
              @Letzforge
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button size="sm" asChild>
              <a href={invite} target="_blank" rel="noreferrer">
                Add to Discord
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-24 border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-3">
                <BrandLogo size={28} />
                <span className="text-sm text-muted-foreground">
                  Free forever. No premium tiers.
                </span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Slux — a feature-rich Discord music bot with a real-time web dashboard.
                Designed &amp; developed by <span className="font-semibold text-foreground">SHM</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
              <div className="space-y-3">
                <p className="font-semibold">Product</p>
                <Link href="/commands" className="block text-muted-foreground transition-colors hover:text-foreground">
                  Commands
                </Link>
                <Link href="/dashboard" className="block text-muted-foreground transition-colors hover:text-foreground">
                  Dashboard
                </Link>
                <Link href="/#features" className="block text-muted-foreground transition-colors hover:text-foreground">
                  Features
                </Link>
              </div>
              <div className="space-y-3">
                <p className="font-semibold">Legal</p>
                <Link href="/terms" className="block text-muted-foreground transition-colors hover:text-foreground">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="block text-muted-foreground transition-colors hover:text-foreground">
                  Privacy Policy
                </Link>
              </div>
              <div className="space-y-3">
                <p className="font-semibold">Support</p>
                <a
                  href={YOUTUBE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Youtube className="h-4 w-4 text-red-500" />
                  YouTube · @Letzforge
                </a>
                <a
                  href={DISCORD_SERVER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MessageCircle className="h-4 w-4 text-indigo-400" />
                  Discord · shahrib
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-6 border-t border-border pt-8">
            {/* Support the developer */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                size="sm"
                asChild
                className="bg-[#ff0000]/90 text-white shadow-lg shadow-red-500/20 hover:bg-[#ff0000]"
              >
                <a href={YOUTUBE_URL} target="_blank" rel="noreferrer">
                  <Youtube className="h-4 w-4" />
                  Support me on YouTube
                </a>
              </Button>
              <Button size="sm" variant="secondary" asChild>
                <a href={DISCORD_SERVER_URL} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Join the Discord
                </a>
              </Button>
            </div>

            {/* Signature */}
            <p className="display-font text-gradient text-center text-2xl font-bold uppercase leading-tight sm:text-3xl md:text-4xl">
              Made with ❤️ by SHM
            </p>

            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Slux · Made &amp; developed by{" "}
              <a
                href={YOUTUBE_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground/80 hover:text-foreground"
              >
                SHM
              </a>{" "}
              (YouTube: @Letzforge, Discord: shahrib) · All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
