import type { BotService } from "@/bot/bot";

declare global {
  var __slux_bot: BotService | undefined;
}

export function getBot(): BotService | null {
  return globalThis.__slux_bot ?? null;
}

export function setBot(bot: BotService): void {
  globalThis.__slux_bot = bot;
}

export function botOrNull(): BotService | undefined {
  return globalThis.__slux_bot;
}
