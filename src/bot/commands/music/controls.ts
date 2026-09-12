import type { BotCommand, CommandContext } from "@/bot/commands/types";
import { getOrCreatePlayer } from "@/bot/commands/helpers";
import { baseEmbed, errorEmbed, EMOJI, statusEmbed, successEmbed } from "@/bot/lib/embeds";
import { controllerPayload } from "@/bot/controller";
import { parseTime } from "@/bot/lib/parse";
import { formatDuration } from "@/lib/utils";

function music(ctx: CommandContext) {
  return ctx.client.music;
}

type Ctx = CommandContext;

const playerPermissions = { player: true, sameVoice: true, dj: true };

/** Control-command reply: status embed + live controller buttons. */
async function replyStatus(
  ctx: Ctx,
  opts: { emoji: string; title: string; description?: string; showButtons?: boolean },
): Promise<void> {
  const player = music(ctx).getPlayer(ctx.guild!.id);
  if (!player || opts.showButtons === false) {
    const embed = baseEmbed().setAuthor({ name: `${opts.emoji} ${opts.title}` });
    if (opts.description) embed.setDescription(opts.description);
    await ctx.reply({ embeds: [embed] });
    return;
  }
  await ctx.reply({
    embeds: [statusEmbed(ctx.t, player, opts)],
    components: controllerPayload(player, ctx.t).components,
  });
}

export const pauseCommand: BotCommand = {
  name: "pause",
  descriptionKey: "commands.pause.description",
  category: "music",
  aliases: [],
  permissions: playerPermissions,
  async execute(ctx: Ctx) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    if (player.paused) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.alreadyPaused"))] });
      return;
    }
    await player.pause();
    await replyStatus(ctx, { emoji: EMOJI.pause, title: ctx.t("music.pausedTitle"), description: ctx.t("music.paused") });
  },
};

export const resumeCommand: BotCommand = {
  name: "resume",
  descriptionKey: "commands.resume.description",
  category: "music",
  aliases: ["unpause"],
  permissions: playerPermissions,
  async execute(ctx: Ctx) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    if (!player.paused) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notPaused"))] });
      return;
    }
    await player.resume();
    await replyStatus(ctx, { emoji: EMOJI.play, title: ctx.t("music.resumedTitle"), description: ctx.t("music.resumed") });
  },
};

export const stopCommand: BotCommand = {
  name: "stop",
  descriptionKey: "commands.stop.description",
  category: "music",
  aliases: ["leave", "dc", "disconnect"],
  permissions: { player: true, sameVoice: true, dj: true },
  async execute(ctx: Ctx) {
    await music(ctx).destroyPlayer(ctx.guild!.id, "stopped");
    await ctx.reply({
      embeds: [
        baseEmbed()
          .setAuthor({ name: `${EMOJI.stop} ${ctx.t("music.stoppedTitle")}` })
          .setDescription(ctx.t("music.stopped")),
      ],
    });
  },
};

export const skipCommand: BotCommand = {
  name: "skip",
  descriptionKey: "commands.skip.description",
  category: "music",
  aliases: ["s", "sk", "fs"],
  permissions: playerPermissions,
  async execute(ctx: Ctx) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const skipped = await player.skip();
    if (skipped) {
      await replyStatus(ctx, {
        emoji: EMOJI.skip,
        title: ctx.t("music.skippedTitle"),
        description: ctx.t("music.skipped", { title: `**${skipped.title}**` }),
      });
    }
  },
};

export const previousCommand: BotCommand = {
  name: "previous",
  descriptionKey: "commands.previous.description",
  category: "music",
  aliases: ["prev", "back"],
  permissions: playerPermissions,
  async execute(ctx: Ctx) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const track = await player.previous();
    if (!track) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.noPrevious"))] });
      return;
    }
    await replyStatus(ctx, { emoji: EMOJI.previous, title: ctx.t("music.previousTitle"), description: ctx.t("music.previousNow") });
  },
};

export const seekCommand: BotCommand = {
  name: "seek",
  descriptionKey: "commands.seek.description",
  category: "music",
  aliases: [],
  permissions: playerPermissions,
  options: [
    {
      name: "position",
      descriptionKey: "commands.seek.options.position",
      type: "string",
      required: true,
    },
  ],
  async execute(ctx: Ctx) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const raw = String(ctx.options.position ?? ctx.args[0] ?? "");
    const ms = parseTime(raw);
    if (ms === null) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }
    const ok = await player.seek(ms);
    if (!ok) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notSeekable"))] });
      return;
    }
    await replyStatus(ctx, {
      emoji: "🎯",
      title: ctx.t("music.seekedTitle"),
      description: ctx.t("music.seeked", { position: `**${formatDuration(ms)}**` }),
    });
  },
};

export const forwardCommand: BotCommand = {
  name: "forward",
  descriptionKey: "commands.forward.description",
  category: "music",
  aliases: ["fw"],
  permissions: playerPermissions,
  options: [
    {
      name: "seconds",
      descriptionKey: "commands.forward.options.seconds",
      type: "integer",
      required: true,
      min: 1,
      max: 3600,
    },
  ],
  async execute(ctx: Ctx) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const seconds = Number(ctx.options.seconds ?? ctx.args[0] ?? 10);
    const target = player.player.position + seconds * 1000;
    const ok = await player.seek(target);
    if (!ok) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notSeekable"))] });
      return;
    }
    await replyStatus(ctx, {
      emoji: "⏩",
      title: ctx.t("music.forwardedTitle"),
      description: ctx.t("music.forwarded", { position: `**${formatDuration(target)}**` }),
    });
  },
};

export const rewindCommand: BotCommand = {
  name: "rewind",
  descriptionKey: "commands.rewind.description",
  category: "music",
  aliases: ["rw"],
  permissions: playerPermissions,
  options: [
    {
      name: "seconds",
      descriptionKey: "commands.rewind.options.seconds",
      type: "integer",
      required: true,
      min: 1,
      max: 3600,
    },
  ],
  async execute(ctx: Ctx) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const seconds = Number(ctx.options.seconds ?? ctx.args[0] ?? 10);
    const target = Math.max(0, player.player.position - seconds * 1000);
    const ok = await player.seek(target);
    if (!ok) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notSeekable"))] });
      return;
    }
    await replyStatus(ctx, {
      emoji: "⏪",
      title: ctx.t("music.rewoundTitle"),
      description: ctx.t("music.rewound", { position: `**${formatDuration(target)}**` }),
    });
  },
};

export const replayCommand: BotCommand = {
  name: "replay",
  descriptionKey: "commands.replay.description",
  category: "music",
  aliases: ["re"],
  permissions: playerPermissions,
  async execute(ctx: Ctx) {
    const player = music(ctx).getPlayer(ctx.guild!.id)!;
    const ok = await player.seek(0);
    if (!ok) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.notSeekable"))] });
      return;
    }
    await replyStatus(ctx, { emoji: "🔁", title: ctx.t("music.replayingTitle"), description: ctx.t("music.replaying") });
  },
};

export const joinCommand: BotCommand = {
  name: "join",
  descriptionKey: "commands.join.description",
  category: "music",
  aliases: ["j", "summon"],
  permissions: { voice: true },
  async execute(ctx: Ctx) {
    const player = await getOrCreatePlayer(ctx);
    if (!player) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.joinFailed"))] });
      return;
    }
    const channel = player.voiceChannel;
    await ctx.reply({
      embeds: [
        successEmbed(ctx.t, ctx.t("music.joined", { channel: `**${channel?.name ?? "voice"}**` }), ctx.t("music.joinedTitle")),
      ],
    });
  },
};
