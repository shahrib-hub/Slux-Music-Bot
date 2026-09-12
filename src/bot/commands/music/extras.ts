import type { BotCommand, CommandContext } from "@/bot/commands/types";
import {
  engineNotReady,
  getOrCreatePlayer,
  presentSearchSelection,
  requesterOf,
} from "@/bot/commands/helpers";
import {
  baseEmbed,
  errorEmbed,
  EMOJI,
  sourceEmoji,
  sourceLabel,
  successEmbed,
  trackAddedEmbed,
} from "@/bot/lib/embeds";
import { toggleRow, toggleStatusEmbed } from "@/bot/controller";
import { sendLyricsPaged } from "@/bot/lib/lyricsview";
import { formatDuration } from "@/lib/utils";

function music(ctx: CommandContext) {
  return ctx.client.music;
}

const playerPermissions = { player: true, sameVoice: true, dj: true };

export const searchCommand: BotCommand = {
  name: "search",
  descriptionKey: "commands.search.description",
  category: "music",
  aliases: ["find"],
  permissions: { voice: true, sameVoice: true },
  options: [
    {
      name: "query",
      descriptionKey: "commands.search.options.query",
      type: "string",
      required: true,
      rest: true,
    },
  ],
  async execute(ctx: CommandContext) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    // ACK immediately — player creation + search resolve take seconds and
    // the final reply edits this deferral.
    await ctx.defer();

    const startedAt = Date.now();

    let player;
    try {
      player = await getOrCreatePlayer(ctx);
    } catch (err) {
      console.error("[slux] createPlayer failed (stale voice connection?):", err);
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.joinFailed"))] });
      return;
    }
    if (!player) {
      console.warn(
        `[slux] search rejected (no player): guild=${ctx.guild?.id ?? "?"} member=${!!ctx.member} ` +
          `voiceChannel=${ctx.member?.voice.channelId ?? "none"}`,
      );
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noVoiceChannel"))] });
      return;
    }
    if (engineNotReady(ctx)) {
      console.warn("[slux] /search rejected: no Lavalink node connected (still starting or unreachable)");
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.engineNotReady"))] });
      return;
    }
    const outcome = await music(ctx).resolve(query, requesterOf(ctx), true);
    console.log(`[slux] /search resolve kind=${outcome.kind} (+${Date.now() - startedAt}ms)`);
    if ((outcome.kind !== "search" && outcome.kind !== "track") || !outcome.tracks?.length) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    if (outcome.kind === "track" && outcome.track) {
      player.enqueue(outcome.track);
      if (!player.current) await player.startIfIdle();
      await ctx.reply({
        embeds: [trackAddedEmbed(ctx.t, outcome.track, { queueLength: player.queue.length })],
      });
      return;
    }
    await presentSearchSelection(ctx, player, query, outcome.tracks!);
  },
};

export const grabCommand: BotCommand = {
  name: "grab",
  descriptionKey: "commands.grab.description",
  category: "music",
  aliases: ["save"],
  permissions: { player: true },
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const track = player.current;
    if (!track) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    const embed = baseEmbed()
      .setAuthor({ name: `${EMOJI.bookmark} ${ctx.t("music.grabTitle")}` })
      .setTitle(track.title.length > 250 ? `${track.title.slice(0, 247)}...` : track.title)
      .setURL(track.uri || null)
      .setDescription(`**${track.author}**`)
      .addFields(
        {
          name: `${EMOJI.clock} ${ctx.t("music.npLength")}`,
          value: track.isStream ? `🔴 ${ctx.t("music.live")}` : `\`${formatDuration(track.length)}\``,
          inline: true,
        },
        {
          name: EMOJI.speaker,
          value: `<#${player.textChannelId ?? ctx.channel?.id}> • ${ctx.guild?.name ?? ""}`,
          inline: true,
        },
        {
          name: `${sourceEmoji(track.sourceName)} ${ctx.t("music.grabSource")}`,
          value: sourceLabel(track.sourceName),
          inline: true,
        },
      )
      .setFooter({
        text: `${ctx.t("common.requestedBy", { user: track.requesterTag })} • Slux`,
        iconURL: track.requesterAvatar || undefined,
      });
    if (track.artwork) embed.setThumbnail(track.artwork);
    try {
      await ctx.author.send({ embeds: [embed] });
      await ctx.reply({
        embeds: [successEmbed(ctx.t, ctx.t("music.grabDmed"), `${EMOJI.bookmark} ${ctx.t("music.grabTitle")}`)],
      });
    } catch {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.grabDmFailed"))] });
    }
  },
};

export const lyricsCommand: BotCommand = {
  name: "lyrics",
  descriptionKey: "commands.lyrics.description",
  category: "music",
  aliases: ["ly"],
  permissions: { player: true },
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const track = player.current;
    if (!track) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    await ctx.defer();

    await sendLyricsPaged({
      music: music(ctx),
      pagination: ctx.pagination,
      player,
      t: ctx.t,
      track,
      send: async (payload) => (await ctx.editReply(payload as never)) ?? null,
    });
  },
};

export const autoplayCommand: BotCommand = {
  name: "autoplay",
  descriptionKey: "commands.autoplay.description",
  category: "music",
  aliases: ["ap"],
  permissions: playerPermissions,
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    player.autoplay = !player.autoplay;
    player.emit();
    await ctx.reply({
      embeds: [toggleStatusEmbed(ctx.t, "autoplay", player.autoplay)],
      components: toggleRow(ctx.t, "autoplay", player.autoplay),
    });
  },
};

export const stayCommand: BotCommand = {
  name: "247",
  descriptionKey: "commands.247.description",
  category: "music",
  aliases: ["stay", "24/7"],
  permissions: playerPermissions,
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    player.stayInChannel = !player.stayInChannel;
    player.emit();
    await ctx.reply({
      embeds: [toggleStatusEmbed(ctx.t, "247", player.stayInChannel)],
      components: toggleRow(ctx.t, "247", player.stayInChannel),
    });
  },
};

export const djModeCommand: BotCommand = {
  name: "djmode",
  descriptionKey: "commands.djmode.description",
  category: "music",
  aliases: ["dj"],
  permissions: playerPermissions,
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    player.djMode = !player.djMode;
    player.emit();
    await ctx.reply({
      embeds: [toggleStatusEmbed(ctx.t, "djmode", player.djMode)],
      components: toggleRow(ctx.t, "djmode", player.djMode),
    });
  },
};

export const sleepCommand: BotCommand = {
  name: "sleep",
  descriptionKey: "commands.sleep.description",
  category: "music",
  aliases: ["timer"],
  permissions: playerPermissions,
  options: [
    {
      name: "minutes",
      descriptionKey: "commands.sleep.options.minutes",
      type: "integer",
      min: 0,
      max: 600,
    },
  ],
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const raw = String(ctx.args[0] ?? "").toLowerCase();
    const value = Number(ctx.options.minutes ?? ctx.args[0] ?? NaN);

    // `sleep off` / `sleep 0` cancels the timer
    if (raw === "off" || raw === "stop" || raw === "cancel" || value === 0) {
      player.setSleepTimer(0);
      await ctx.reply({
        embeds: [successEmbed(ctx.t, ctx.t("music.sleepCancelled"), `${EMOJI.clock} ${ctx.t("music.sleepTitle")}`)],
      });
      return;
    }

    // No argument: show the current timer status
    if (!Number.isFinite(value)) {
      if (player.sleepTimerUntil) {
        const minutes = Math.max(1, Math.ceil((player.sleepTimerUntil - Date.now()) / 60_000));
        await ctx.reply({
          embeds: [
            baseEmbed()
              .setAuthor({ name: `${EMOJI.clock} ${ctx.t("music.sleepTitle")}` })
              .setDescription(ctx.t("music.sleepStatus", { minutes: `**${minutes}**` })),
          ],
        });
      } else {
        await ctx.reply({
          embeds: [baseEmbed().setAuthor({ name: `${EMOJI.clock} ${ctx.t("music.sleepTitle")}` })
            .setDescription(ctx.t("music.sleepNone"))],
        });
      }
      return;
    }

    if (value < 1 || value > 600) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }

    player.setSleepTimer(value);
    await ctx.reply({
      embeds: [
        successEmbed(
          ctx.t,
          ctx.t("music.sleepSet", { minutes: `**${value}**` }),
          `${EMOJI.clock} ${ctx.t("music.sleepTitle")}`,
        ),
      ],
    });
  },
};
