import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type EmbedBuilder,
} from "discord.js";
import type { PaginationManager, ComponentInteraction, ComponentRow } from "@/bot/controller";
import { commandCatalog } from "@/lib/command-catalog";
import type { Translator } from "@/i18n";
import { baseEmbed, EMOJI, dashboardBase } from "@/bot/lib/embeds";
import { getEnv } from "@/lib/env";
import { inviteUrl as buildInviteUrl } from "@/lib/invite";

export function inviteUrl(): string {
  return buildInviteUrl(getEnv().DISCORD_CLIENT_ID);
}

export interface HelpCategory {
  id: string;
  emoji: string;
  labelKey: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "music", emoji: "🎵", labelKey: "info.helpFields.music" },
  { id: "playlists", emoji: "📁", labelKey: "info.helpFields.playlists" },
  { id: "filters", emoji: "🎛️", labelKey: "info.helpFields.filters" },
  { id: "settings", emoji: "⚙️", labelKey: "info.helpFields.settings" },
  { id: "info", emoji: "ℹ️", labelKey: "info.helpFields.info" },
];

function categoryOf(id: string): HelpCategory {
  return HELP_CATEGORIES.find((c) => c.id === id) ?? HELP_CATEGORIES[0];
}

function helpSelectRow(t: Translator): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("slux:help")
    .setPlaceholder(t("info.helpPickCategory"))
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      HELP_CATEGORIES.map((category) => {
        const count = commandCatalog.filter((c) => c.category === category.id).length;
        return {
          label: t(category.labelKey),
          value: category.id,
          description: t("info.helpCategoryCount", { count }).slice(0, 100),
          emoji: category.emoji,
        };
      }),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function helpLinkRow(t: Translator): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel(t("info.inviteButton"))
      .setEmoji("🤖")
      .setStyle(ButtonStyle.Link)
      .setURL(inviteUrl()),
  );
  const dashboard = dashboardBase();
  if (dashboard) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(t("info.dashboardButton"))
        .setEmoji("🖥️")
        .setStyle(ButtonStyle.Link)
        .setURL(dashboard),
    );
  }
  return row;
}

export function buildHelpOverview(
  t: Translator,
  prefix: string,
): { embeds: EmbedBuilder[]; components: ComponentRow[] } {
  const total = commandCatalog.length;
  const embed = baseEmbed()
    .setAuthor({ name: `${EMOJI.music} Slux — ${t("info.helpTitle")}` })
    .setDescription(t("info.helpDescription", { prefix }))
    .addFields(
      HELP_CATEGORIES.map((category) => {
        const commands = commandCatalog.filter((c) => c.category === category.id);
        const names = commands
          .slice(0, 6)
          .map((c) => `\`${c.name}\``)
          .join(" ");
        return {
          name: `${category.emoji} ${t(category.labelKey)} — ${commands.length}`,
          value: `${names}${commands.length > 6 ? ` … ${t("info.helpAndMore", { count: commands.length - 6 })}` : ""}`,
          inline: false,
        };
      }),
    )
    .setFooter({ text: `${EMOJI.music} Slux • ${total} ${t("common.commands")}` });

  return {
    embeds: [embed],
    components: [helpSelectRow(t), helpLinkRow(t)],
  };
}

function helpCategoryEmbed(
  t: Translator,
  commands: (typeof commandCatalog)[number][],
  categoryId: string,
  prefix: string,
  page: number,
  totalPages: number,
): EmbedBuilder {
  const category = categoryOf(categoryId);
  const perPage = 8;
  const start = (page - 1) * perPage;
  const items = commands.slice(start, start + perPage);

  const embed = baseEmbed()
    .setAuthor({ name: `${category.emoji} ${t(category.labelKey)} — ${t("info.helpCommandsTitle")}` })
    .setDescription(
      items
        .map((command) => {
          const aliases = command.aliases.length > 0 ? `\n> ${EMOJI.pin} \`${prefix}${command.aliases.join(`\`, \`${prefix}`)}\`` : "";
          return `**/${command.name}** — ${t(command.descriptionKey)}${aliases}`;
        })
        .join("\n\n")
        .slice(0, 3900),
    )
    .setFooter({
      text: `${t("common.page", { current: page, total: totalPages })} • ${commands.length} ${t("common.commands")}`,
    });
  return embed;
}

/** Handle a category pick from the help select menu (paginated listing). */
export async function handleHelpSelect(
  interaction: ComponentInteraction,
  pagination: PaginationManager,
  t: Translator,
  categoryRaw: string,
  prefix = "/",
): Promise<void> {
  const category = categoryOf(categoryRaw);
  const commands = commandCatalog.filter((c) => c.category === category.id);
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(commands.length / perPage));

  const id = pagination.create(totalPages, (page) => ({
    embeds: [helpCategoryEmbed(t, commands, category.id, prefix, page, totalPages)],
    rows: [helpSelectRow(t), helpLinkRow(t)],
  }));

  const view = pagination.build(id, 1);
  await interaction.update(view).catch(() => {});
}

// ── @mention help ────────────────────────────────────────────────

/** Reply shown when the bot is mentioned with no other text: guild prefix
 *  plus quick-start help, with buttons to the command list and dashboard. */
export function buildMentionHelp(
  t: Translator,
  prefix: string,
): { embeds: EmbedBuilder[]; components: ComponentRow[] } {
  const dashboard = dashboardBase();

  const embed = baseEmbed()
    .setAuthor({ name: `👋 ${t("common.mentionHelp.title")}` })
    .setDescription(t("common.mentionHelp.description"))
    .addFields(
      {
        name: `⌨️ ${t("common.mentionHelp.prefixField")}`,
        value: t("common.mentionHelp.prefixValue", { prefix: `\`${prefix}\`` }),
        inline: true,
      },
      {
        name: `✨ ${t("common.mentionHelp.slashField")}`,
        value: t("common.mentionHelp.slashValue"),
        inline: true,
      },
      {
        name: `🔥 ${t("common.mentionHelp.popularField")}`,
        value: [
          `🎵 \`/play\` • \`/search\` • \`/queue\``,
          `🎧 \`/nowplaying\` • \`/lyrics\` • \`/grab\``,
          `🎛️ \`/filters\` • \`/bassboost\` • \`/loop\``,
          `📜 \`/playlist\` • \`/favorites\` • \`/help\``,
        ].join("\n"),
        inline: false,
      },
      {
        name: `💡 ${t("common.mentionHelp.tipField")}`,
        value: t("common.mentionHelp.tipValue", { prefix: `\`${prefix}\`` }),
        inline: false,
      },
    )
    .setFooter({ text: `Slux • ${commandCatalog.length} ${t("common.commands")}` });

  const linkRow = new ActionRowBuilder<ButtonBuilder>();
  if (dashboard) {
    linkRow.addComponents(
      new ButtonBuilder()
        .setLabel(t("common.mentionHelp.commandsButton"))
        .setEmoji("📜")
        .setStyle(ButtonStyle.Link)
        .setURL(`${dashboard}/commands`),
      new ButtonBuilder()
        .setLabel(t("common.mentionHelp.dashboardButton"))
        .setEmoji("🖥️")
        .setStyle(ButtonStyle.Link)
        .setURL(dashboard),
    );
  }
  linkRow.addComponents(
    new ButtonBuilder()
      .setLabel(t("common.mentionHelp.inviteButton"))
      .setEmoji("🤖")
      .setStyle(ButtonStyle.Link)
      .setURL(inviteUrl()),
  );

  return { embeds: [embed], components: [linkRow] };
}
