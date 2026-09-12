"use client";

import { useEffect, useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/dashboard-shell";
import { useI18n } from "@/components/i18n-provider";
import { apiFetch, apiUrl } from "@/lib/api";

interface Me {
  id: string;
  username: string;
  avatar: string;
}

/**
 * Client-side auth gate for the dashboard. With the split deployment the
 * session lives on the backend (httpOnly cookie on its domain), so pages
 * check `/api/auth/me` with credentials and render the shell only when
 * authenticated — anonymous visitors get a login card instead.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<"loading" | "ok" | "anon">("loading");
  const [user, setUser] = useState<Me | null>(null);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) {
          setState("anon");
          return null;
        }
        return r.json();
      })
      .then((data: { user?: Me } | null) => {
        if (data?.user) {
          setUser(data.user);
          setState("ok");
        }
      })
      .catch(() => setState("anon"));
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "anon") {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="sluxlucent-bg" aria-hidden />
        <div className="glass mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl p-10 text-center">
          <LogIn className="h-10 w-10 text-primary" />
          <h1 className="text-xl font-semibold">{t("dashboard.auth.loginRequired")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.auth.loginRequiredDescription")}
          </p>
          <Button size="lg" asChild className="mt-2">
            <a href={apiUrl("/api/auth/login")}>{t("dashboard.auth.login")}</a>
          </Button>
        </div>
      </div>
    );
  }

  return <DashboardShell user={{ username: user!.username, avatar: user!.avatar }}>{children}</DashboardShell>;
}
