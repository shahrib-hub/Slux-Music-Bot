"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

/** Dark/light mode toggle for the Sluxlucent theme. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  return (
    <Button
      variant="ghost"
      size="iconSm"
      onClick={toggle}
      title={t("dashboard.nav.theme")}
      aria-label={t("dashboard.nav.theme")}
      className={className}
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}
