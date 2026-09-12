import type { Message } from "discord.js";

/** Parse a time argument like "1:30", "90", "1m30s", "1h 2m" into milliseconds. */
export function parseTime(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10) * 1000;

  const colon = trimmed.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) {
    if (colon[3] !== undefined) {
      return (parseInt(colon[1], 10) * 3600 + parseInt(colon[2], 10) * 60 + parseInt(colon[3], 10)) * 1000;
    }
    return (parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10)) * 1000;
  }

  const units = trimmed.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i);
  if (units && (units[1] || units[2] || units[3])) {
    const h = parseInt(units[1] ?? "0", 10);
    const m = parseInt(units[2] ?? "0", 10);
    const s = parseInt(units[3] ?? "0", 10);
    return (h * 3600 + m * 60 + s) * 1000;
  }
  return null;
}

/** Tokenize a prefix command string respecting double quotes. */
export function tokenize(content: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of content) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === " " && !inQuotes) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function avatarUrlOf(message: Message): string {
  return message.author.displayAvatarURL({ size: 64 });
}
