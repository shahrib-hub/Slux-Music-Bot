import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { BotCommand, CommandContext } from "@/bot/commands/types";
import { baseEmbed, errorEmbed, EMOJI, filterEmoji, successEmbed } from "@/bot/lib/embeds";
import { buildFiltersPanel } from "@/bot/lib/filtersview";
import { BASSBOOST_LEVELS, TOGGLEABLE_FILTERS } from "@/bot/music/filters";

function music(ctx: CommandContext) {
  return ctx.client.music;
}

const playerPermissions = { player: true, sameVoice: true, dj: true };

/** "Open filter panel" button appended to filter command confirmations. */
function filterPanelRow(t: (key: string) => string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("slux:fxopen")
        .setLabel(t("filters.openPanel"))
        .setEmoji(EMOJI.filters)
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

async function toggleFilter(ctx: CommandContext, filter: string, value?: unknown): Promise<void> {
  const player = music(ctx).getPlayer(ctx.guild!.id);
  if (!player) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
    return;
  }
  const emoji = filterEmoji(filter);
  if (player.hasFilter(filter)) {
    await player.removeFilter(filter);
    await ctx.reply({
      embeds: [
        baseEmbed()
          .setAuthor({ name: `${emoji} ${ctx.t("filters.removedTitle")}` })
          .setDescription(ctx.t("filters.removed", { name: `**${filter}**` })),
      ],
      components: filterPanelRow(ctx.t),
    });
    return;
  }
  await player.applyFilter(filter, value);
  await ctx.reply({
    embeds: [
      successEmbed(ctx.t, ctx.t("filters.applied", { name: `**${filter}**` }), `${emoji} ${ctx.t("filters.appliedTitle")}`),
    ],
    components: filterPanelRow(ctx.t),
  });
}

function simpleFilterCommand(
  name: string,
  descriptionKey: string,
  filter: string,
  aliases: string[] = [],
): BotCommand {
  return {
    name,
    descriptionKey,
    category: "filters",
    aliases,
    permissions: playerPermissions,
    async execute(ctx: CommandContext) {
      await toggleFilter(ctx, filter);
    },
  };
}

export const bassboostCommand: BotCommand = {
  name: "bassboost",
  descriptionKey: "commands.bassboost.description",
  category: "filters",
  aliases: ["bass", "bb"],
  permissions: playerPermissions,
  options: [
    {
      name: "level",
      descriptionKey: "commands.bassboost.options.level",
      type: "string",
      choices: [
        { nameKey: "low", value: "low" },
        { nameKey: "medium", value: "medium" },
        { nameKey: "high", value: "high" },
        { nameKey: "insane", value: "insane" },
      ],
    },
  ],
  async execute(ctx: CommandContext) {
    const level = String(ctx.options.level ?? ctx.args[0] ?? "medium").toLowerCase();
    if (!(level in BASSBOOST_LEVELS)) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("filters.invalidLevel"))] });
      return;
    }
    await toggleFilter(ctx, "bassboost", BASSBOOST_LEVELS[level]);
  },
};

export const nightcoreCommand = simpleFilterCommand("nightcore", "commands.nightcore.description", "nightcore", ["nc"]);
export const vaporwaveCommand = simpleFilterCommand("vaporwave", "commands.vaporwave.description", "vaporwave", ["vw"]);
export const softCommand = simpleFilterCommand("soft", "commands.soft.description", "soft");
export const eightDCommand = simpleFilterCommand("8d", "commands.8d.description", "8d", ["eightd"]);
export const karaokeCommand = simpleFilterCommand("karaoke", "commands.karaoke.description", "karaoke");
export const tremoloCommand = simpleFilterCommand("tremolo", "commands.tremolo.description", "tremolo");
export const vibratoCommand = simpleFilterCommand("vibrato", "commands.vibrato.description", "vibrato");
export const distortionCommand = simpleFilterCommand("distortion", "commands.distortion.description", "distortion");
export const lowpassCommand = simpleFilterCommand("lowpass", "commands.lowpass.description", "lowpass", ["lp"]);

async function timescaleCommand(ctx: CommandContext, kind: "speed" | "pitch"): Promise<void> {
  const player = music(ctx).getPlayer(ctx.guild!.id);
  if (!player) {
    await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
    return;
  }
  const raw = ctx.options.value ?? ctx.args[0];
  if (raw === undefined) {
    await player.removeFilter(kind === "speed" ? "speed" : "pitch");
    await ctx.reply({
      embeds: [
        baseEmbed()
          .setAuthor({ name: `${filterEmoji(kind)} ${ctx.t("filters.removedTitle")}` })
          .setDescription(ctx.t("filters.removed", { name: `**${kind}**` })),
      ],
      components: filterPanelRow(ctx.t),
    });
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.5 || value > 5) {
    await ctx.reply({
      embeds: [errorEmbed(ctx.t, ctx.t("filters.invalidValue", { min: 0.5, max: 5 }))],
    });
    return;
  }
  await player.applyFilter(kind, value);
  await ctx.reply({
    embeds: [
      successEmbed(
        ctx.t,
        ctx.t("filters.applied", { name: `**${kind} ${value}x**` }),
        `${filterEmoji(kind)} ${ctx.t("filters.appliedTitle")}`,
      ),
    ],
    components: filterPanelRow(ctx.t),
  });
}

export const speedCommand: BotCommand = {
  name: "speed",
  descriptionKey: "commands.speed.description",
  category: "filters",
  aliases: [],
  permissions: playerPermissions,
  options: [
    { name: "value", descriptionKey: "commands.speed.options.value", type: "number", required: true, min: 0.5, max: 5 },
  ],
  async execute(ctx) {
    await timescaleCommand(ctx, "speed");
  },
};

export const pitchCommand: BotCommand = {
  name: "pitch",
  descriptionKey: "commands.pitch.description",
  category: "filters",
  aliases: [],
  permissions: playerPermissions,
  options: [
    { name: "value", descriptionKey: "commands.pitch.options.value", type: "number", required: true, min: 0.5, max: 5 },
  ],
  async execute(ctx) {
    await timescaleCommand(ctx, "pitch");
  },
};

export const eqCommand: BotCommand = {
  name: "eq",
  descriptionKey: "commands.eq.description",
  category: "filters",
  aliases: ["equalizer"],
  permissions: playerPermissions,
  options: [
    {
      name: "bands",
      descriptionKey: "commands.eq.options.bands",
      type: "string",
      required: true,
      rest: true,
    },
  ],
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id);
    if (!player) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    const raw = String(ctx.options.bands ?? ctx.args.join(" ") ?? "")
      .trim()
      .split(/[\s,]+/)
      .map((v) => parseFloat(v))
      .filter((v) => Number.isFinite(v));
    if (raw.length === 0 || raw.length > 15 || raw.some((v) => v < -1 || v > 1)) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("filters.eqUsage", { prefix: ctx.prefix }))] });
      return;
    }
    await player.applyFilter("eq", raw);
    await ctx.reply({
      embeds: [
        successEmbed(ctx.t, ctx.t("filters.eqApplied"), `${filterEmoji("eq")} ${ctx.t("filters.appliedTitle")}`),
      ],
      components: filterPanelRow(ctx.t),
    });
  },
};

export const filtersCommand: BotCommand = {
  name: "filters",
  descriptionKey: "commands.filters.description",
  category: "filters",
  aliases: ["fx"],
  permissions: { player: true },
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id);
    if (!player) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    const panel = buildFiltersPanel(player, ctx.t);
    await ctx.reply(panel);
  },
};

export const filtersResetCommand: BotCommand = {
  name: "reset",
  descriptionKey: "commands.filtersreset.description",
  category: "filters",
  aliases: ["resetfilters", "clearfilters"],
  permissions: playerPermissions,
  async execute(ctx: CommandContext) {
    const player = music(ctx).getPlayer(ctx.guild!.id);
    if (!player) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.noPlayer"))] });
      return;
    }
    await player.resetFilters();
    await ctx.reply({ embeds: [successEmbed(ctx.t, ctx.t("filters.reset"), `${EMOJI.filters} ${ctx.t("filters.resetTitle")}`)] });
  },
};

export const toggleableFilterList = TOGGLEABLE_FILTERS;
