import type { BotCommand, CommandContext } from "@/bot/commands/types";
import { baseEmbed, errorEmbed, localeChoices, localeLabel, successEmbed, EMOJI } from "@/bot/lib/embeds";
import { getGuildSettings, updateGuildSettings, invalidateGuildCache } from "@/db/repositories/guilds";
import { LOCALES, createTranslator, normalizeLocale } from "@/i18n";

export const settingsCommand: BotCommand = {
  name: "settings",
  descriptionKey: "commands.settings.description",
  category: "settings",
  aliases: ["config"],
  permissions: { manageGuild: true },
  async execute(ctx: CommandContext) {
    const settings = await getGuildSettings(ctx.guild!.id);
    const t = ctx.t;
    const embed = baseEmbed()
      .setAuthor({
        name: `${EMOJI.settings} ${t("settings.title", { guild: ctx.guild?.name ?? "" })}`,
        iconURL: ctx.guild?.iconURL() ?? undefined,
      })
      .addFields(
        { name: `⌨️ ${t("settings.prefix")}`, value: `\`${settings.prefix}\``, inline: true },
        { name: `${EMOJI.globe} ${t("settings.language")}`, value: localeLabel(normalizeLocale(settings.language)), inline: true },
        { name: `${EMOJI.volume} ${t("settings.defaultVolume")}`, value: `\`${settings.defaultVolume}%\``, inline: true },
        {
          name: `${EMOJI.autoplay} ${t("settings.autoplay")}`,
          value: settings.defaultAutoplay ? `${EMOJI.ok} ${t("common.enabled")}` : `${EMOJI.error} ${t("common.disabled")}`,
          inline: true,
        },
        {
          name: `${EMOJI.infinity} ${t("settings.247")}`,
          value: settings.default247 ? `${EMOJI.ok} ${t("common.enabled")}` : `${EMOJI.error} ${t("common.disabled")}`,
          inline: true,
        },
        {
          name: `${EMOJI.clock} ${t("settings.idleTimeout")}`,
          value: settings.idleTimeout > 0 ? `\`${settings.idleTimeout} ${t("common.minutes")}\`` : `♾️ ${t("settings.noTimeout")}`,
          inline: true,
        },
        {
          name: `${EMOJI.dj} ${t("settings.djRoles")}`,
          value:
            settings.djRoles.length > 0
              ? settings.djRoles.map((r) => `<@&${r}>`).join(" ")
              : `*${t("common.none")}*`,
          inline: false,
        },
        {
          name: `#️⃣ ${t("settings.botChannels")}`,
          value:
            settings.botChannels.length > 0
              ? settings.botChannels.map((c) => `<#${c}>`).join(" ")
              : `*${t("settings.allChannels")}*`,
          inline: false,
        },
      )
      .setFooter({ text: `Slux • ${ctx.guild?.name ?? ""}` });
    await ctx.reply({ embeds: [embed] });
  },
};

export const prefixCommand: BotCommand = {
  name: "prefix",
  descriptionKey: "commands.prefix.description",
  category: "settings",
  aliases: [],
  permissions: { manageGuild: true },
  options: [
    { name: "prefix", descriptionKey: "commands.prefix.options.prefix", type: "string", required: true },
  ],
  async execute(ctx: CommandContext) {
    const prefix = String(ctx.options.prefix ?? ctx.args[0] ?? "").trim();
    if (!prefix || prefix.length > 5 || /\s/.test(prefix)) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.prefixInvalid"))] });
      return;
    }
    await updateGuildSettings(ctx.guild!.id, { prefix });
    invalidateGuildCache(ctx.guild!.id);
    await ctx.reply({
      embeds: [successEmbed(ctx.t, ctx.t("settings.prefixSet", { prefix }))] });
  },
};

export const languageCommand: BotCommand = {
  name: "language",
  descriptionKey: "commands.language.description",
  category: "settings",
  aliases: ["lang"],
  permissions: { manageGuild: true },
  options: [
    {
      name: "language",
      descriptionKey: "commands.language.options.language",
      type: "string",
      required: true,
      choices: localeChoices().map((c) => ({ nameKey: c.name, value: c.value })),
    },
  ],
  async execute(ctx: CommandContext) {
    const raw = String(ctx.options.language ?? ctx.args[0] ?? "").toLowerCase();
    const locale = normalizeLocale(raw);
    if (raw !== locale && !LOCALES.some((l) => l.code === raw)) {
      await ctx.reply({
        embeds: [
          errorEmbed(
            ctx.t,
            ctx.t("settings.languageInvalid", { languages: LOCALES.map((l) => l.code).join(", ") }),
          ),
        ],
      });
      return;
    }
    await updateGuildSettings(ctx.guild!.id, { language: locale });
    invalidateGuildCache(ctx.guild!.id);
    const newT = createTranslator(locale);
    await ctx.reply({
      embeds: [successEmbed(newT, newT("settings.languageSet", { language: localeLabel(locale) }))] });
  },
};

export const djRoleCommand: BotCommand = {
  name: "djrole",
  descriptionKey: "commands.djrole.description",
  category: "settings",
  aliases: [],
  permissions: { manageGuild: true },
  subcommands: [
    { name: "add", descriptionKey: "commands.djrole.subcommands.add.description", options: [{ name: "role", descriptionKey: "commands.djrole.subcommands.add.options.role", type: "role", required: true }] },
    { name: "remove", descriptionKey: "commands.djrole.subcommands.remove.description", options: [{ name: "role", descriptionKey: "commands.djrole.subcommands.remove.options.role", type: "role", required: true }] },
    { name: "list", descriptionKey: "commands.djrole.subcommands.list.description" },
  ],
  async execute(ctx: CommandContext) {
    const settings = await getGuildSettings(ctx.guild!.id);
    switch (ctx.subcommand) {
      case "add": {
        const roleId = String(ctx.options.role ?? ctx.args[0] ?? "");
        if (settings.djRoles.includes(roleId)) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.djRoleNotSet"))] });
          return;
        }
        await updateGuildSettings(ctx.guild!.id, { djRoles: [...settings.djRoles, roleId] });
        await ctx.reply({
          embeds: [successEmbed(ctx.t, ctx.t("settings.djRoleAdded", { role: `<@&${roleId}>` }))] });
        return;
      }
      case "remove": {
        const roleId = String(ctx.options.role ?? ctx.args[0] ?? "");
        if (!settings.djRoles.includes(roleId)) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.djRoleNotSet"))] });
          return;
        }
        await updateGuildSettings(ctx.guild!.id, { djRoles: settings.djRoles.filter((r) => r !== roleId) });
        await ctx.reply({
          embeds: [successEmbed(ctx.t, ctx.t("settings.djRoleRemoved", { role: `<@&${roleId}>` }))] });
        return;
      }
      case "list":
      default: {
        if (settings.djRoles.length === 0) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.djRoleNone"))] });
          return;
        }
        await ctx.reply({
          embeds: [
            baseEmbed()
              .setAuthor({ name: `${EMOJI.dj} ${ctx.t("settings.djRoles")}` })
              .setDescription(
                settings.djRoles.map((r) => `<@&${r}>`).join(" • "),
              ),
          ],
        });
        return;
      }
    }
  },
};

export const botChannelCommand: BotCommand = {
  name: "botchannel",
  descriptionKey: "commands.botchannel.description",
  category: "settings",
  aliases: [],
  permissions: { manageGuild: true },
  subcommands: [
    { name: "add", descriptionKey: "commands.botchannel.subcommands.add.description", options: [{ name: "channel", descriptionKey: "commands.botchannel.subcommands.add.options.channel", type: "channel", required: true }] },
    { name: "remove", descriptionKey: "commands.botchannel.subcommands.remove.description", options: [{ name: "channel", descriptionKey: "commands.botchannel.subcommands.remove.options.channel", type: "channel", required: true }] },
    { name: "clear", descriptionKey: "commands.botchannel.subcommands.clear.description" },
  ],
  async execute(ctx: CommandContext) {
    const settings = await getGuildSettings(ctx.guild!.id);
    switch (ctx.subcommand) {
      case "add": {
        const channelId = String(ctx.options.channel ?? ctx.args[0] ?? "").replace(/[<#>]/g, "");
        if (settings.botChannels.includes(channelId)) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.botChannelNotSet"))] });
          return;
        }
        await updateGuildSettings(ctx.guild!.id, { botChannels: [...settings.botChannels, channelId] });
        await ctx.reply({
          embeds: [successEmbed(ctx.t, ctx.t("settings.botChannelAdded", { channel: `<#${channelId}>` }))] });
        return;
      }
      case "remove": {
        const channelId = String(ctx.options.channel ?? ctx.args[0] ?? "").replace(/[<#>]/g, "");
        if (!settings.botChannels.includes(channelId)) {
          await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("settings.botChannelNotSet"))] });
          return;
        }
        await updateGuildSettings(ctx.guild!.id, {
          botChannels: settings.botChannels.filter((c) => c !== channelId),
        });
        await ctx.reply({
          embeds: [successEmbed(ctx.t, ctx.t("settings.botChannelRemoved", { channel: `<#${channelId}>` }))] });
        return;
      }
      case "clear":
      default: {
        await updateGuildSettings(ctx.guild!.id, { botChannels: [] });
        await ctx.reply({ embeds: [successEmbed(ctx.t, ctx.t("settings.botChannelCleared"))] });
        return;
      }
    }
  },
};

export const defaultVolumeCommand: BotCommand = {
  name: "defaultvolume",
  descriptionKey: "commands.defaultvolume.description",
  category: "settings",
  aliases: ["defvol"],
  permissions: { manageGuild: true },
  options: [
    { name: "level", descriptionKey: "commands.defaultvolume.options.level", type: "integer", required: true, min: 0, max: 150 },
  ],
  async execute(ctx: CommandContext) {
    const level = Number(ctx.options.level ?? ctx.args[0] ?? NaN);
    if (!Number.isFinite(level) || level < 0 || level > 150) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }
    await updateGuildSettings(ctx.guild!.id, { defaultVolume: level });
    await ctx.reply({ embeds: [successEmbed(ctx.t, ctx.t("settings.defaultVolumeSet", { level }))] });
  },
};

export const idleTimeoutCommand: BotCommand = {
  name: "idletimeout",
  descriptionKey: "commands.idletimeout.description",
  category: "settings",
  aliases: ["idle"],
  permissions: { manageGuild: true },
  options: [
    { name: "minutes", descriptionKey: "commands.idletimeout.options.minutes", type: "integer", required: true, min: 0, max: 120 },
  ],
  async execute(ctx: CommandContext) {
    const minutes = Number(ctx.options.minutes ?? ctx.args[0] ?? NaN);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 120) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("common.invalidNumber"))] });
      return;
    }
    await updateGuildSettings(ctx.guild!.id, { idleTimeout: minutes });
    if (minutes === 0) {
      await ctx.reply({ embeds: [successEmbed(ctx.t, ctx.t("settings.idleTimeoutDisabled"))] });
    } else {
      await ctx.reply({
        embeds: [successEmbed(ctx.t, ctx.t("settings.idleTimeoutSet", { minutes }))] });
    }
  },
};
