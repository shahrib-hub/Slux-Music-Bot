"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { normalizeLocale, t as translate, type Locale } from "@/i18n";

const STORAGE_KEY = "slux.locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const browser = typeof navigator !== "undefined" ? navigator.language : "en";
    setLocaleState(normalizeLocale(stored ?? browser));
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback for RSC or missing provider
    return { locale: "en", setLocale: () => {}, t: (key, vars) => translate("en", key, vars) };
  }
  return ctx;
}
