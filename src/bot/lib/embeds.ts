import { EmbedBuilder, type Client } from "discord.js";
import type { Shoukaku } from "shoukaku";
import type { MusicManager } from "@/bot/music/MusicManager";
import type { GuildPlayer } from "@/bot/music/GuildPlayer";
import type { ResolvedTrack } from "@/bot/music/types";
import { formatDuration } from "@/lib/utils";
import type { Locale, Translator } from "@/i18n";

declare module "discord.js" {
  interface Client {
    shoukaku: Shoukaku;
    music: MusicManager;
  }
}

// ── Brand palette ────────────────────────────────────────────────

export const BRAND_COLOR = 0x8b5cf6;
export const ERROR_COLOR = 0xef4444;
export const SUCCESS_COLOR = 0x22c55e;
export const WARN_COLOR = 0xf59e0b;
export const INFO_COLOR = 0x38bdf8;
export const QUEUE_COLOR = 0x6366f1;

// ── Emoji library ────────────────────────────────────────────────

export const EMOJI = {
  previous: "⏮️",
  play: "▶️",
  pause: "⏸️",
  stop: "⏹️",
  skip: "⏭️",
  loop: "🔁",
  loopTrack: "🔂",
  loopOff: "➡️",
  shuffle: "🔀",
  volume: "🔊",
  volumeDown: "🔉",
  volumeMute: "🔇",
  queue: "📜",
  nowPlaying: "🎧",
  added: "➕",
  addedTop: "⏫",
  playlist: "📁",
  lyrics: "📝",
  music: "🎵",
  cd: "💿",
  mic: "🎤",
  autoplay: "✨",
  clock: "⏱️",
  star: "⭐",
  heart: "❤️",
  filters: "🎛️",
  settings: "⚙️",
  globe: "🌐",
  info: "ℹ️",
  ok: "✅",
  error: "❌",
  warn: "⚠️",
  user: "👤",
  dj: "🎧",
  infinity: "♾️",
  rocket: "🚀",
  wave: "🌊",
  link: "🔗",
  pin: "📍",
  fire: "🔥",
  bookmark: "🔖",
  history: "🕘",
  gear: "⚙️",
  page: "📄",
  speaker: "📢",
} as const;

export const FILTER_EMOJI: Record<string, string> = {
  bassboost: "🔊",
  nightcore: "🚀",
  vaporwave: "🌴",
  soft: "🕊️",
  "8d": "🌀",
  karaoke: "🎤",
  tremolo: "〰️",
  vibrato: "🎚️",
  distortion: "💥",
  lowpass: "📉",
  speed: "⏩",
  pitch: "🎼",
  eq: "🎚️",
};

export function filterEmoji(name: string): string {
  return FILTER_EMOJI[name.toLowerCase()] ?? EMOJI.filters;
}

// ── Core builders ────────────────────────────────────────────────

export function baseEmbed(color: number = BRAND_COLOR): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

export function errorEmbed(t: Translator, message: string, title?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(ERROR_COLOR)
    .setAuthor({ name: `${EMOJI.error} ${title ?? t("common.errorTitle")}` });
  if (message) embed.setDescription(message);
  return embed;
}

export function successEmbed(t: Translator, message: string, title?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(SUCCESS_COLOR)
    .setAuthor({ name: `${EMOJI.ok} ${title ?? t("common.doneTitle")}` });
  if (message) embed.setDescription(message);
  return embed;
}

export function warnEmbed(t: Translator, message: string, title?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(WARN_COLOR)
    .setAuthor({ name: `${EMOJI.warn} ${title ?? t("common.warnTitle")}` });
  if (message) embed.setDescription(message);
  return embed;
}

// ── Text decorations ─────────────────────────────────────────────

export function sourceEmoji(sourceName: string): string {
  const s = (sourceName || "").toLowerCase();
  if (s.includes("spotify")) return "🟢";
  if (s.includes("youtube")) return "🔴";
  if (s.includes("soundcloud")) return "🟠";
  if (s.includes("deezer")) return "🟣";
  if (s.includes("applemusic")) return "🍎";
  if (s.includes("tidal")) return "🌊";
  if (s.includes("http") || s.includes("local")) return "🔗";
  return "🎵";
}

export function sourceLabel(sourceName: string): string {
  const s = (sourceName || "").toLowerCase();
  if (s.includes("spotify")) return "Spotify";
  if (s.includes("youtube")) return "YouTube";
  if (s.includes("soundcloud")) return "SoundCloud";
  if (s.includes("deezer")) return "Deezer";
  if (s.includes("applemusic")) return "Apple Music";
  if (s.includes("tidal")) return "Tidal";
  if (s.includes("http")) return "Direct link";
  return sourceName || "Unknown";
}

/** Classic `▬▬▬🔘▬▬▬` playback bar with time labels. */
export function progressBar(position: number, length: number, size = 14): string {
  if (!Number.isFinite(length) || length <= 0) return "";
  const ratio = Math.min(1, Math.max(0, position / length));
  const filled = Math.round(ratio * (size - 1));
  const bar = "▬".repeat(filled) + "🔘" + "▬".repeat(Math.max(0, size - 1 - filled));
  return `\`${formatDuration(position)}\` ${bar} \`${formatDuration(length)}\``;
}

/** `▰▰▰▱▱` volume meter. */
export function volumeBar(level: number, size = 10): string {
  const clamped = Math.min(150, Math.max(0, level));
  const filled = Math.round((clamped / 150) * size);
  return "▰".repeat(filled) + "▱".repeat(Math.max(0, size - filled));
}

export function trackLine(track: ResolvedTrack, index?: number): string {
  const duration = track.isStream ? "LIVE" : formatDuration(track.length);
  const prefix = index !== undefined ? `\`${index}.\`` : "▸";
  const title = track.uri ? `[${track.title}](${track.uri})` : track.title;
  return `${prefix} ${title} — **${track.author}** \`[${duration}]\``;
}

// ── Composite embeds ─────────────────────────────────────────────

/** Rich "added to queue" confirmation. */
export function trackAddedEmbed(
  t: Translator,
  track: ResolvedTrack,
  extras: { position?: number; queueLength: number; top?: boolean; totalDuration?: number },
): EmbedBuilder {
  const embed = baseEmbed()
    .setAuthor({
      name: `${extras.top ? EMOJI.addedTop : EMOJI.added} ${t(extras.top ? "music.addedTopTitle" : "music.addedTitle")}`,
    })
    .setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title)
    .setURL(track.uri || null)
    .setDescription(`**${track.author}**`);

  if (track.artwork) embed.setThumbnail(track.artwork);

  embed.addFields(
    {
      name: `${EMOJI.clock} ${t("music.npLength")}`,
      value: track.isStream ? `🔴 ${t("music.live")}` : `\`${formatDuration(track.length)}\``,
      inline: true,
    },
    {
      name: `${EMOJI.queue} ${t("music.queuePosition")}`,
      value: `\`#${extras.position ?? extras.queueLength}\``,
      inline: true,
    },
    {
      name: `${EMOJI.cd} ${t("music.queueTotal")}`,
      value: `\`${extras.queueLength}\` ${t("common.tracks")}`,
      inline: true,
    },
  );

  embed.setFooter({
    text: `${t("common.requestedBy", { user: track.requesterTag })} • ${sourceEmoji(track.sourceName)} ${sourceLabel(track.sourceName)}`,
    iconURL: track.requesterAvatar || undefined,
  });
  return embed;
}

/** Upgraded now-playing embed with a live progress bar. */
export function nowPlayingEmbed(
  t: Translator,
  track: ResolvedTrack,
  extras: { position: number; volume: number; repeat: string; filters: string[]; paused: boolean },
): EmbedBuilder {
  const statusEmoji = extras.paused ? EMOJI.pause : EMOJI.nowPlaying;
  const statusText = extras.paused ? t("music.pausedLabel") : t("music.nowPlaying");

  const embed = baseEmbed()
    .setAuthor({ name: `${statusEmoji} ${statusText}`, iconURL: track.requesterAvatar || undefined })
    .setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title)
    .setURL(track.uri || null)
    .setDescription(`**${track.author}**`)
    .setFooter({
      text: `${t("common.requestedBy", { user: track.requesterTag })} • ${sourceEmoji(track.sourceName)} ${sourceLabel(track.sourceName)}`,
      iconURL: track.requesterAvatar || undefined,
    });

  if (track.artwork) embed.setThumbnail(track.artwork);

  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (!track.isStream) {
    fields.push({
      name: `${EMOJI.clock} ${t("music.npProgress")}`,
      value: progressBar(extras.position, track.length) || "—",
      inline: false,
    });
  } else {
    fields.push({ name: EMOJI.fire, value: `🔴 ${t("music.live")} — ${t("music.stream")}`, inline: false });
  }
  fields.push({ name: `${EMOJI.volume} ${t("music.npVolume")}`, value: `\`${extras.volume}%\``, inline: true });
  fields.push({
    name: `${loopEmoji(extras.repeat)} ${t("music.npLoop")}`,
    value: `\`${loopLabel(t, extras.repeat)}\``,
    inline: true,
  });
  fields.push({
    name: `${EMOJI.filters} ${t("music.npFilters")}`,
    value: extras.filters.length > 0 ? extras.filters.map((f) => filterEmoji(f)).join(" ") : t("common.none"),
    inline: true,
  });
  return embed.addFields(fields);
}

export function loopEmoji(repeat: string): string {
  return repeat === "track" ? EMOJI.loopTrack : repeat === "queue" ? EMOJI.loop : EMOJI.loopOff;
}

export function loopLabel(t: Translator, repeat: string): string {
  return repeat === "track" ? t("music.loopModeTrack") : repeat === "queue" ? t("music.loopModeQueue") : t("music.loopModeOff");
}

/** Rich status embed used by control commands — action result plus a mini player. */
export function statusEmbed(
  t: Translator,
  player: GuildPlayer,
  opts: { emoji: string; title: string; description?: string },
): EmbedBuilder {
  const embed = baseEmbed().setAuthor({ name: `${opts.emoji} ${opts.title}` });
  if (opts.description) embed.setDescription(opts.description);

  const track = player.current;
  if (track) {
    const lines = [
      `${EMOJI.music} **[${track.title}](${track.uri || "https://discord.com"})**`,
      `👤 **${track.author}**`,
    ];
    if (!track.isStream) {
      lines.push(progressBar(player.player.position, track.length) || "");
    }
    embed.addFields({ name: EMOJI.nowPlaying, value: lines.filter(Boolean).join("\n"), inline: false });
    if (track.artwork) embed.setThumbnail(track.artwork);
    embed.setFooter({
      text: `${EMOJI.volume} ${player.volume}% • ${loopEmoji(player.repeat)} ${loopLabel(t, player.repeat)} • ${sourceEmoji(track.sourceName)} ${sourceLabel(track.sourceName)}`,
    });
  }
  return embed;
}

export function localeChoices(): { name: string; value: string }[] {
  return [
    { name: "🇬🇧 English", value: "en" },
    { name: "🇮🇳 हिन्दी", value: "hi" },
    { name: "🇪🇸 Español", value: "es" },
    { name: "🇫🇷 Français", value: "fr" },
    { name: "🇩🇪 Deutsch", value: "de" },
    { name: "🇧🇷 Português", value: "pt" },
  ];
}

export function localeLabel(locale: Locale): string {
  return localeChoices().find((c) => c.value === locale)?.name ?? locale;
}

export function clientShoukaku(client: Client): Shoukaku | undefined {
  return client.shoukaku;
}
