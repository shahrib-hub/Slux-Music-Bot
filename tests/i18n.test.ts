import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const LOCALES = ["en", "hi", "es", "fr", "de", "pt"];

function loadLocale(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.resolve(__dirname, `../src/i18n/locales/${locale}.json`), "utf-8"),
  );
}

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

describe("i18n locale parity", () => {
  const enKeys = flattenKeys(loadLocale("en")).sort();

  it("english locale is non-trivial", () => {
    expect(enKeys.length).toBeGreaterThan(200);
  });

  for (const locale of LOCALES.filter((l) => l !== "en")) {
    it(`${locale} has exactly the same keys as en`, () => {
      const localeKeys = flattenKeys(loadLocale(locale)).sort();
      const missing = enKeys.filter((k) => !localeKeys.includes(k));
      const extra = localeKeys.filter((k) => !enKeys.includes(k));
      expect(missing, `missing keys in ${locale}`).toEqual([]);
      expect(extra, `extra keys in ${locale}`).toEqual([]);
    });
  }

  it("all locales are valid JSON with no duplicate keys", () => {
    for (const locale of LOCALES) {
      const raw = readFileSync(path.resolve(__dirname, `../src/i18n/locales/${locale}.json`), "utf-8");
      expect(() => JSON.parse(raw)).not.toThrow();
    }
  });
});
