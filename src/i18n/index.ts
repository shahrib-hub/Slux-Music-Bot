import en from "./locales/en.json";
import hi from "./locales/hi.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import pt from "./locales/pt.json";

export type Locale = "en" | "hi" | "es" | "fr" | "de" | "pt";

export const LOCALES: { code: Locale; label: string; flag: string; discord: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧", discord: "en-US" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳", discord: "hi" },
  { code: "es", label: "Español", flag: "🇪🇸", discord: "es-ES" },
  { code: "fr", label: "Français", flag: "🇫🇷", discord: "fr" },
  { code: "de", label: "Deutsch", flag: "🇩🇪", discord: "de" },
  { code: "pt", label: "Português", flag: "🇧🇷", discord: "pt-BR" },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);

const bundles: Record<Locale, unknown> = { en, hi, es, fr, de, pt };

function lookup(obj: unknown, key: string): unknown {
  let current: unknown = obj;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : match,
  );
}

const missingLogged = new Set<string>();

export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  let raw = lookup(bundles[locale] ?? bundles.en, key);
  if (typeof raw !== "string") {
    if (locale !== "en" && !missingLogged.has(`${locale}:${key}`)) {
      missingLogged.add(`${locale}:${key}`);
      if (process.env.NODE_ENV === "development") {
        console.warn(`[i18n] missing key "${key}" in locale "${locale}", falling back to en`);
      }
    }
    raw = lookup(bundles.en, key);
  }
  if (typeof raw !== "string") return key;
  return interpolate(raw, vars);
}

export function createTranslator(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) => t(locale, key, vars);
}

export type Translator = ReturnType<typeof createTranslator>;

export function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return "en";
  const base = value.split("-")[0].toLowerCase();
  return (LOCALE_CODES as string[]).includes(base) ? (base as Locale) : "en";
}
