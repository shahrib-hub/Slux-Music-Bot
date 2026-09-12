import type { BotCommand, CommandContext } from "@/bot/commands/types";
import {
  baseEmbed,
  errorEmbed,
  EMOJI,
  nowPlayingEmbed,
  sourceEmoji,
  sourceLabel,
  successEmbed,
} from "@/bot/lib/embeds";
import { buildQueueMessage } from "@/bot/lib/queueview";
import { controllerPayload, loopRow, loopStatusEmbed, volumeRow, volumeStatusEmbed } from "@/bot/controller";
import { formatDuration } from "@/lib/utils";
import type { LoopMode } from "@/bot/music/types";

function music(ctx: CommandContext) {
  return ctx.client.music;
}

const playerPermissions = { player: true, sameVoice: true, dj: true };

export const queueCommand: BotCommand = {
  name: "queue",
  descriptionKey: "commands.queue.description",
  category: "music",
  aliases: ["q", "que"],
  permissions: { player: true },
  options: [
    { name: "page", descriptionKey: "commands.queue.options.page", type: "integer", min: 1, max: 100 },
  ],
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id);
    const page = Number(ctx.options.page ?? ctx.args[0] ?? 1) || 1;
    const { embed, components } = await buildQueueMessage(
      player,
      ctx.guild?.name ?? "",
      page,
      ctx.t,
      ctx.guild?.iconURL() ?? undefined,
    );
    await ctx.reply({ embeds: [embed], components });
  },
};

export const nowplayingCommand: BotCommand = {
  name: "nowplaying",
  descriptionKey: "commands.nowplaying.description",
  category: "music",
  aliases: ["np", "now"],
  permissions: { player: true },
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    if (!player.current) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    const snapshot = player.snapshot();
    await ctx.reply({
      embeds: [
        nowPlayingEmbed(ctx.t, player.current, {
          position: player.player.position,
          volume: player.volume,
          repeat: player.repeat,
          filters: snapshot.filters,
          paused: player.paused,
        }),
      ],
      components: controllerPayload(player, ctx.t).components,
    });
  },
};

export const removeCommand: BotCommand = {
  name: "remove",
  descriptionKey: "commands.remove.description",
  category: "music",
  aliases: ["rm"],
  permissions: playerPermissions,
  options: [
    { name: "index", descriptionKey: "commands.remove.options.index", type: "integer", required: true, min: 1 },
  ],
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const index = Number(ctx.options.index ?? ctx.args[0] ?? 0);
    const removed = player.removeAt(index);
    if (!removed) {
      await ctx.reply({
        embeds: [errorEmbed(ctx.t, ctx.t("music.invalidIndex", { index }))],
      });
      return;
    }
    const embed = baseEmbed()
      .setAuthor({ name: `${EMOJI.error} ${ctx.t("music.removedTitle")}` })
      .setTitle(removed.title.length > 250 ? `${removed.title.slice(0, 247)}...` : removed.title)
      .setURL(removed.uri || null)
      .setDescription(`**${removed.author}** • \`#${index}\``)
      .setFooter({
        text: `${ctx.t("common.requestedBy", { user: ctx.author.tag })} • ${sourceEmoji(removed.sourceName)} ${sourceLabel(removed.sourceName)}`,
        iconURL: ctx.author.displayAvatarURL({ size: 64 }),
      });
    if (removed.artwork) embed.setThumbnail(removed.artwork);
    await ctx.reply({ embeds: [embed] });
  },
};

export const clearCommand: BotCommand = {
  name: "clear",
  descriptionKey: "commands.clear.description",
  category: "music",
  aliases: [],
  permissions: playerPermissions,
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const count = player.clearQueue();
    await ctx.reply({
      embeds: [successEmbed(ctx.t, ctx.t("music.cleared", { count }), ctx.t("music.clearedTitle"))],
    });
  },
};

export const moveCommand: BotCommand = {
  name: "move",
  descriptionKey: "commands.move.description",
  category: "music",
  aliases: ["mv"],
  permissions: playerPermissions,
  options: [
    { name: "from", descriptionKey: "commands.move.options.from", type: "integer", required: true, min: 1 },
    { name: "to", descriptionKey: "commands.move.options.to", type: "integer", required: true, min: 1 },
  ],
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const from = Number(ctx.options.from ?? ctx.args[0] ?? 0);
    const to = Number(ctx.options.to ?? ctx.args[1] ?? 0);
    const moved = player.moveTrack(from, to);
    if (!moved) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.invalidIndex", { index: from }))] });
      return;
    }
    const embed = baseEmbed()
      .setAuthor({ name: `📌 ${ctx.t("music.movedTitle")}` })
      .setTitle(moved.title.length > 250 ? `${moved.title.slice(0, 247)}...` : moved.title)
      .setURL(moved.uri || null)
      .setDescription(
        `${ctx.t("music.moved", { title: `**${moved.title}**`, from, to })}\n\n\`#${from}\` ${EMOJI.loopOff} \`#${to}\``,
      );
    if (moved.artwork) embed.setThumbnail(moved.artwork);
    await ctx.reply({ embeds: [embed] });
  },
};

export const shuffleCommand: BotCommand = {
  name: "shuffle",
  descriptionKey: "commands.shuffle.description",
  category: "music",
  aliases: ["sh", "mix"],
  permissions: playerPermissions,
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    if (player.queue.length === 0) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.queueEmpty"))] });
      return;
    }
    const count = player.shuffleQueue();
    await ctx.reply({
      embeds: [
        successEmbed(ctx.t, ctx.t("music.shuffled", { count }), `${EMOJI.shuffle} ${ctx.t("music.shuffledTitle")}`),
      ],
    });
  },
};

export const skipToCommand: BotCommand = {
  name: "skipto",
  descriptionKey: "commands.skipto.description",
  category: "music",
  aliases: ["st", "jump"],
  permissions: playerPermissions,
  options: [
    {
      name: "index",
      descriptionKey: "commands.skipto.options.index",
      type: "integer",
      required: true,
      min: 1,
      max: 1000,
    },
  ],
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const index = Number(ctx.options.index ?? ctx.args[0] ?? 0);
    const target = player.skipTo(index);
    if (!target) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.invalidIndex", { index }))] });
      return;
    }
    const embed = baseEmbed()
      .setAuthor({ name: `⏭️ ${ctx.t("music.skiptoTitle")}` })
      .setTitle(target.title.length > 250 ? `${target.title.slice(0, 247)}...` : target.title)
      .setURL(target.uri || null)
      .setDescription(`**${target.author}**\n\n${ctx.t("music.skiptoDone", { index: `\`#${index}\`` })}`);
    if (target.artwork) embed.setThumbnail(target.artwork);
    await ctx.reply({ embeds: [embed] });
  },
};

export const removeDuplicatesCommand: BotCommand = {
  name: "removeduplicates",
  descriptionKey: "commands.removeduplicates.description",
  category: "music",
  aliases: ["rdup", "removedupes"],
  permissions: playerPermissions,
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    if (player.queue.length === 0) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.queueEmpty"))] });
      return;
    }
    const removed = player.removeDuplicates();
    if (removed === 0) {
      await ctx.reply({
        embeds: [successEmbed(ctx.t, ctx.t("music.noDuplicates"), `${EMOJI.ok} ${ctx.t("music.removedDuplicatesTitle")}`)],
      });
      return;
    }
    await ctx.reply({
      embeds: [
        successEmbed(
          ctx.t,
          ctx.t("music.removedDuplicates", { count: removed }),
          `${EMOJI.ok} ${ctx.t("music.removedDuplicatesTitle")}`,
        ),
      ],
    });
  },
};

export const loopCommand: BotCommand = {
  name: "loop",
  descriptionKey: "commands.loop.description",
  category: "music",
  aliases: ["l", "repeat"],
  permissions: playerPermissions,
  options: [
    {
      name: "mode",
      descriptionKey: "commands.loop.options.mode",
      type: "string",
      choices: [
        { nameKey: "off", value: "off" },
        { nameKey: "track", value: "track" },
        { nameKey: "queue", value: "queue" },
      ],
    },
  ],
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const raw = String(ctx.options.mode ?? ctx.args[0] ?? "");
    let mode: LoopMode;
    if (raw === "off" || raw === "track" || raw === "queue") {
      mode = raw;
    } else {
      mode = player.cycleRepeat();
    }
    await player.setRepeat(mode);
    await ctx.reply({
      embeds: [loopStatusEmbed(ctx.t, player)],
      components: loopRow(ctx.t, player),
    });
  },
};

export const volumeCommand: BotCommand = {
  name: "volume",
  descriptionKey: "commands.volume.description",
  category: "music",
  aliases: ["vol", "v"],
  permissions: playerPermissions,
  options: [
    { name: "level", descriptionKey: "commands.volume.options.level", type: "integer", min: 0, max: 150 },
  ],
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const raw = ctx.options.level ?? ctx.args[0];
    if (raw === undefined) {
      await ctx.reply({
        embeds: [volumeStatusEmbed(ctx.t, player)],
        components: volumeRow(ctx.t, player),
      });
      return;
    }
    const level = Number(raw);
    if (!Number.isFinite(level) || level < 0 || level > 150) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }
    await player.setVolume(level);
    await ctx.reply({
      embeds: [volumeStatusEmbed(ctx.t, player)],
      components: volumeRow(ctx.t, player),
    });
  },
};

export const queueDurationText = (player: import("@/bot/music/GuildPlayer").GuildPlayer): string => {
  return formatDuration(player.queue.reduce((a, t) => a + t.length, 0));
};
