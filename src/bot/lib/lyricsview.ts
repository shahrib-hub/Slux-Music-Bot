import type { EmbedBuilder, Message } from "discord.js";
import type { MusicManager } from "@/bot/music/MusicManager";
import type { PaginationManager } from "@/bot/controller";
import type { GuildPlayer } from "@/bot/music/GuildPlayer";
import type { LyricsResult, ResolvedTrack } from "@/bot/music/types";
import type { Translator } from "@/i18n";
import { baseEmbed, EMOJI, errorEmbed } from "@/bot/lib/embeds";
import { formatDuration } from "@/lib/utils";

/** Split lyrics into embed-safe pages (~1900 chars each). */
export function buildLyricsPages(lyrics: LyricsResult): string[] {
  const chunks: string[] = [];
  if (lyrics.synced && lyrics.lines.length > 0) {
    for (const line of lyrics.lines) {
      const stamp = formatDuration(line.timestamp);
      chunks.push(`\`${stamp}\` ${line.line}`);
    }
  } else if (lyrics.text) {
    chunks.push(...lyrics.text.split("\n"));
  }

  const pages: string[] = [];
  let current = "";
  for (const line of chunks) {
    if (current.length + line.length > 1900) {
      pages.push(current);
      current = "";
    }
    current += `${line}\n`;
  }
  if (current.trim()) pages.push(current);
  return pages.length > 0 ? pages : ["—"];
}

export function lyricsEmbed(
  t: Translator,
  track: ResolvedTrack,
  lyrics: LyricsResult,
  pageContent: string,
  page: number,
  totalPages: number,
): EmbedBuilder {
  const embed = baseEmbed()
    .setAuthor({ name: `${EMOJI.lyrics} ${t("music.lyricsTitle")}` })
    .setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title)
    .setURL(track.uri || null)
    .setDescription(pageContent.slice(0, 3900))
    .setFooter({
      text: `${t("common.page", { current: page, total: totalPages })} • ${
        lyrics.synced ? `🎙️ ${t("music.lyricsSynced")}` : `📄 ${t("music.lyricsPlain")}`
      } • ${lyrics.source || "lyrics"}`,
    });
  if (track.artwork) embed.setThumbnail(track.artwork);
  return embed;
}

/** Fetch lyrics and send them as a button-paginated message. */
export async function sendLyricsPaged(opts: {
  music: MusicManager;
  pagination?: PaginationManager;
  player: GuildPlayer;
  t: Translator;
  track: ResolvedTrack;
  send: (payload: { embeds: EmbedBuilder[]; components?: unknown[] }) => Promise<Message | null>;
}): Promise<void> {
  const { music, pagination, player, t, track } = opts;
  const lyrics = await music.lyricsForTrack(player.guildId, track);
  if (!lyrics || (!lyrics.lines?.length && !lyrics.text)) {
    await opts.send({
      embeds: [errorEmbed(t, t("music.lyricsNone"), t("music.lyricsTitle"))],
      components: [],
    });
    return;
  }

  const pages = buildLyricsPages(lyrics);

  // No pagination manager (e.g. minimal contexts): send the first page only.
  if (!pagination) {
    await opts.send({ embeds: [lyricsEmbed(t, track, lyrics, pages[0] ?? "", 1, pages.length)] });
    return;
  }

  const id = pagination.create(pages.length, (page) => ({
    embeds: [lyricsEmbed(t, track, lyrics, pages[page - 1] ?? "", page, pages.length)],
  }));

  const view = pagination.build(id, 1);
  const message = await opts.send(view);
  pagination.attach(id, message);
}
