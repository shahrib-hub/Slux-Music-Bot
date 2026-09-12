import type { BotCommand } from "@/bot/commands/types";
import { resolveAndPlay } from "@/bot/commands/helpers";
import { errorEmbed } from "@/bot/lib/embeds";

const playBase = {
  category: "music" as const,
  permissions: { voice: true, sameVoice: true },
  aliases: [] as string[],
};

export const playCommand: BotCommand = {
  ...playBase,
  name: "play",
  descriptionKey: "commands.play.description",
  aliases: ["p"],
  options: [
    {
      name: "query",
      descriptionKey: "commands.play.options.query",
      type: "string",
      required: true,
      rest: true,
    },
  ],
  async execute(ctx) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    await resolveAndPlay(ctx, query, "end");
  },
};

export const playnextCommand: BotCommand = {
  ...playBase,
  name: "playnext",
  descriptionKey: "commands.playnext.description",
  aliases: ["pn"],
  options: [
    {
      name: "query",
      descriptionKey: "commands.playnext.options.query",
      type: "string",
      required: true,
      rest: true,
    },
  ],
  async execute(ctx) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    await resolveAndPlay(ctx, query, "next");
  },
};

export const playtopCommand: BotCommand = {
  ...playBase,
  name: "playtop",
  descriptionKey: "commands.playtop.description",
  aliases: ["pt"],
  options: [
    {
      name: "query",
      descriptionKey: "commands.playtop.options.query",
      type: "string",
      required: true,
      rest: true,
    },
  ],
  async execute(ctx) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    await resolveAndPlay(ctx, query, "top");
  },
};

export const playskipCommand: BotCommand = {
  ...playBase,
  name: "playskip",
  descriptionKey: "commands.playskip.description",
  aliases: ["ps"],
  options: [
    {
      name: "query",
      descriptionKey: "commands.playskip.options.query",
      type: "string",
      required: true,
      rest: true,
    },
  ],
  async execute(ctx) {
    const query = String(ctx.options.query ?? ctx.args.join(" ") ?? "").trim();
    if (!query) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.nothingFound"))] });
      return;
    }
    await resolveAndPlay(ctx, query, "skip");
  },
};
