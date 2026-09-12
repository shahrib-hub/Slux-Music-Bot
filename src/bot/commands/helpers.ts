import type { CommandContext } from "@/bot/commands/types";
import type { GuildPlayer } from "@/bot/music/GuildPlayer";
import { getGuildSettings } from "@/db/repositories/guilds";
import {
  baseEmbed,
  errorEmbed,
  EMOJI,
  sourceEmoji,
  sourceLabel,
  trackAddedEmbed,
} from "@/bot/lib/embeds";
import { buildSearchSelectComponents } from "@/bot/controller";
import { formatDuration } from "@/lib/utils";
import type { ResolvedTrack } from "@/bot/music/types";

export type PlayMode = "end" | "next" | "top" | "skip";

/** Get or create the guild player, applying saved guild defaults for fresh players. */
export async function getOrCreatePlayer(ctx: CommandContext): Promise<GuildPlayer | null> {
  if (!ctx.guild || !ctx.member) return null;
  const music = ctx.client.music;
  const existing = music.getPlayer(ctx.guild.id);
  const player = await music.createPlayer(ctx.member, null, ctx.channel);
  if (!player) return null;
  if (!existing) {
    const settings = await getGuildSettings(ctx.guild.id);
    await player.setVolume(settings.defaultVolume);
    player.autoplay = settings.defaultAutoplay;
    player.stayInChannel = settings.default247;
    player.setIdleTimeout(settings.idleTimeout);
    await player.refreshLocale();
  }
  return player;
}

export function requesterOf(ctx: CommandContext): { id: string; tag: string; avatar: string } {
  return {
    id: ctx.author.id,
    tag: ctx.author.tag,
    avatar: ctx.author.displayAvatarURL({ size: 64 }),
  };
}

function insertPosition(player: GuildPlayer, mode: PlayMode): number | undefined {
  switch (mode) {
    case "top":
      return 0;
    case "next":
      return 0;
    default:
      return undefined;
  }
}

/** True when no Lavalink node is connected yet (still booting/unreachable). */
export function engineNotReady(ctx: CommandContext): boolean {
  return !ctx.client.shoukaku.getIdealNode();
}

/** Core play flow shared by play/playnext/playtop/playskip and the search picker. */
export async function resolveAndPlay(
  ctx: CommandContext,
  query: string,
  mode: PlayMode = "end",
): Promise<void> {
  // ACK the interaction FIRST: the voice join and multi-source resolve below
  // can each take seconds — the final reply edits this deferral, so Discord
  // never times the interaction out and the user never waits on a dead
  // "thinking" state.
  await ctx.defer();

  const startedAt = Date.now();
  const log = (stage: string) =>
    console.log(`[slux] /${ctx.interaction?.commandName ?? "play"} ${stage} (+${Date.now() - startedAt}ms)`);

  let player: GuildPlayer | null = null;
  try {
    player = await getOrCreatePlayer(ctx);
  } catch (err) {
    console.error("[slux] createPlayer failed (stale voice connection?):", err);
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.joinFailed"))] });
    return;
  }
  if (!player) {
    console.warn(
      `[slux] play rejected (no player): guild=${ctx.guild?.id ?? "?"} member=${!!ctx.member} ` +
        `voiceChannel=${ctx.member?.voice.channelId ?? "none"}`,
    );
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noVoiceChannel"))] });
    return;
  }
  log("player ready");

  if (engineNotReady(ctx)) {
    console.warn("[slux] /play rejected: no Lavalink node connected (still starting or unreachable)");
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.engineNotReady"))] });
    return;
  }

  const outcome = await ctx.client.music.resolve(query, requesterOf(ctx));
  log(`resolve kind=${outcome.kind}`);

  if (outcome.kind === "empty" || outcome.kind === "error") {
    console.warn(
      `[slux] resolve failed for query "${query.slice(0, 80)}": kind=${outcome.kind}`,
    );
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
    return;
  }

  if (outcome.kind === "track" && outcome.track) {
    await enqueueTrack(ctx, player, outcome.track, mode);
    return;
  }

  if (outcome.kind === "playlist" && outcome.tracks) {
    const position = insertPosition(player, mode);
    player.enqueueMany(outcome.tracks, position);
    if (!player.current) await player.startIfIdle();
    if (mode === "skip") await player.skip();
    const totalMs = outcome.tracks.reduce((a, t) => a + t.length, 0);
    const embed = baseEmbed()
      .setAuthor({ name: `${EMOJI.playlist} ${ctx.t("music.playlistAddedTitle")}` })
      .setTitle((outcome.playlistName ?? "Playlist").slice(0, 250))
      .setDescription(ctx.t("music.addedPlaylist", { count: outcome.tracks.length, name: outcome.playlistName ?? "Playlist" }))
      .addFields(
        {
          name: `${EMOJI.cd} ${ctx.t("music.queueTotal")}`,
          value: `\`${player.queue.length}\` ${ctx.t("common.tracks")}`,
          inline: true,
        },
        {
          name: `${EMOJI.clock} ${ctx.t("music.totalDuration")}`,
          value: `\`${formatDuration(totalMs)}\``,
          inline: true,
        },
      )
      .setFooter({
        text: `${ctx.t("common.requestedBy", { user: ctx.author.tag })} • ${EMOJI.playlist} Playlist`,
        iconURL: ctx.author.displayAvatarURL({ size: 64 }),
      });
    const first = outcome.tracks[0];
    if (first?.artwork) embed.setThumbnail(first.artwork);
    await ctx.reply({ embeds: [embed] });
    return;
  }

  if (outcome.kind === "search" && outcome.tracks) {
    await presentSearchSelection(ctx, player, query, outcome.tracks, mode);
    return;
  }
}

export async function enqueueTrack(
  ctx: CommandContext,
  player: GuildPlayer,
  track: ResolvedTrack,
  mode: PlayMode,
): Promise<void> {
  const wasEmpty = !player.current;
  switch (mode) {
    case "top":
    case "next":
      player.enqueue(track, 0);
      await ctx.reply({
        embeds: [
          trackAddedEmbed(ctx.t, track, {
            position: 1,
            queueLength: player.queue.length,
            top: true,
          }),
        ],
      });
      break;
    case "skip": {
      player.enqueue(track, 0);
      if (player.current) {
        await player.skip();
        await ctx.reply({
          embeds: [
            baseEmbed()
              .setAuthor({ name: `${EMOJI.skip} ${ctx.t("music.skipPlayTitle")}` })
              .setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title)
              .setURL(track.uri || null)
              .setDescription(`**${track.author}**`),
          ],
        });
      } else {
        await player.startIfIdle();
        await ctx.reply({
          embeds: [trackAddedEmbed(ctx.t, track, { queueLength: player.queue.length })],
        });
      }
      break;
    }
    default:
      player.enqueue(track);
      await ctx.reply({
        embeds: [
          trackAddedEmbed(ctx.t, track, {
            queueLength: player.queue.length,
          }),
        ],
      });
  }
  if (wasEmpty && mode === "end") await player.startIfIdle();
}

export async function presentSearchSelection(
  ctx: CommandContext,
  player: GuildPlayer,
  query: string,
  tracks: ResolvedTrack[],
  _mode: PlayMode = "end",
): Promise<void> {
  const embed = baseEmbed()
    .setAuthor({ name: `${EMOJI.music} ${ctx.t("music.searchResultsTitle")}` })
    .setDescription(
      `**${ctx.t("music.selectPrompt", { query: query.slice(0, 150) })}**\n\n` +
        tracks
          .map(
            (track, i) =>
              `\`${i + 1}.\` ${sourceEmoji(track.sourceName)} [${track.title}](${track.uri || "https://discord.com"}) — **${track.author}** \`[${
                track.isStream ? "LIVE" : formatDuration(track.length)
              }]\``,
          )
          .join("\n"),
    )
    .setFooter({
      text: `${EMOJI.clock} ${ctx.t("music.selectFooter")} • ${sourceLabel(tracks[0]?.sourceName ?? "")}`,
    });

  // Without a session store the picker buttons cannot work — show the plain
  // results list instead of an interactive picker that would dead-end.
  const searchSessions = ctx.searchSessions;
  if (!searchSessions) {
    await ctx.reply({ embeds: [embed] });
    return;
  }

  const sessionId = Math.random().toString(36).slice(2, 10);
  const message = await ctx.reply({
    embeds: [embed],
    components: buildSearchSelectComponents(ctx.t, sessionId, tracks),
  });

  if (!message) return;

  const timeout = setTimeout(() => {
    searchSessions.delete(message.id);
    void message
      .edit({ embeds: [baseEmbed().setAuthor({ name: `${EMOJI.clock} ${ctx.t("common.timeUp")}` })], components: [] })
      .catch(() => {});
  }, 30_000);
  timeout.unref?.();

  searchSessions.set(message.id, {
    tracks,
    timeout,
    userId: ctx.author.id,
  });
}

export function trackSummary(track: ResolvedTrack): string {
  const duration = track.isStream ? "LIVE" : formatDuration(track.length);
  const title = track.uri ? `[${track.title}](${track.uri})` : track.title;
  return `▸ ${title} — **${track.author}** \`[${duration}]\``;
}
