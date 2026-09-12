"use client";

import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

/** Shown when the Discord access token inside the session has expired.
 *  `prompt: "none"` on our OAuth URL makes re-login a single click. */
export function SessionExpiredCard() {
  const { t } = useI18n();
  return (
    <div className="glass mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl p-10 text-center">
      <LogIn className="h-10 w-10 text-primary" />
      <div>
        <h2 className="text-lg font-semibold">{t("dashboard.auth.loginRequired")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("dashboard.auth.loginRequiredDescription")}
        </p>
      </div>
      <Button asChild>
        <a href="/api/auth/login">{t("dashboard.auth.login")}</a>
      </Button>
    </div>
  );
}
