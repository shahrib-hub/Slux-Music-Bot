import { describe, it, expect } from "vitest";
import { t, LOCALES } from "@/i18n";
import { commandCatalog } from "@/lib/command-catalog";

// Discord command name rules: 1-32 chars, lowercase letters/numbers/-/_
const NAME_RE = /^[-_\p{L}\p{N}]{1,32}$/u;

describe("slash command registration constraints", () => {
  it("all command names are valid for Discord", () => {
    for (const command of commandCatalog) {
      expect(
        NAME_RE.test(command.name),
        `command name "${command.name}" is invalid`,
      ).toBe(true);
    }
  });

  it("command names are unique", () => {
    const names = commandCatalog.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every localized description fits Discord's 100-char limit", () => {
    for (const command of commandCatalog) {
      for (const locale of LOCALES) {
        const text = t(locale.code, command.descriptionKey);
        expect(
          typeof text === "string" && text.length > 0 && text.length <= 100,
          `${command.name} description in ${locale.code} is "${text?.slice(0, 40)}..." (${text?.length} chars)`,
        ).toBe(true);
      }
    }
  });

  it("command count matches expectations (50+)", () => {
    expect(commandCatalog.length).toBeGreaterThanOrEqual(50);
  });
});
