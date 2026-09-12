import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type EmbedBuilder,
} from "discord.js";
import type { ComponentInteraction, ComponentRow } from "@/bot/controller";
import type { GuildPlayer } from "@/bot/music/GuildPlayer";
import { BASSBOOST_LEVELS, TOGGLEABLE_FILTERS } from "@/bot/music/filters";
import type { Translator } from "@/i18n";
import { baseEmbed, EMOJI, filterEmoji } from "@/bot/lib/embeds";

/** The interactive filter panel: dropdown to toggle + reset button. */
export function buildFiltersPanel(
  player: GuildPlayer,
  t: Translator,
): { embeds: EmbedBuilder[]; components: ComponentRow[] } {
  const active = player.snapshot().filters;

  const embed = baseEmbed()
    .setAuthor({ name: `${EMOJI.filters} ${t("filters.panelTitle")}` })
    .setDescription(t("filters.panelHint"));

  if (active.length === 0) {
    embed.addFields({ name: t("filters.listTitle"), value: t("filters.listNone"), inline: false });
  } else {
    embed.addFields({
      name: t("filters.listTitle"),
      value: active.map((f) => `${filterEmoji(f)} **${f}** — ${t("common.on")}`).join("\n"),
      inline: false,
    });
  }

  const track = player.current;
  if (track) {
    embed.setThumbnail(track.artwork || null);
    embed.setFooter({
      text: `${EMOJI.music} ${track.title}`.slice(0, 200),
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("slux:fx")
    .setPlaceholder(t("filters.pickPlaceholder"))
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      TOGGLEABLE_FILTERS.map((filter) => {
        const isActive = active.includes(filter);
        return {
          label: filter.charAt(0).toUpperCase() + filter.slice(1),
          value: filter,
          description: (isActive ? t("filters.stateOn") : t("filters.stateOff")).slice(0, 100),
          emoji: filterEmoji(filter),
          default: isActive,
        };
      }),
    );

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("slux:fxreset")
      .setLabel(t("filters.resetAll"))
      .setEmoji("↩️")
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row1, row2] };
}

export async function handleFilterSelect(
  interaction: ComponentInteraction,
  player: GuildPlayer,
  t: Translator,
  nameRaw: string,
): Promise<void> {
  const name = (TOGGLEABLE_FILTERS as readonly string[]).includes(nameRaw) ? nameRaw : null;
  if (!name) return;

  if (name === "bassboost" && !player.hasFilter("bassboost")) {
    await player.applyFilter("bassboost", BASSBOOST_LEVELS.medium);
  } else if (player.hasFilter(name)) {
    await player.removeFilter(name);
  } else {
    await player.applyFilter(name);
  }

  await interaction.update(buildFiltersPanel(player, t)).catch(() => {});
}

export async function handleFilterReset(
  interaction: ComponentInteraction,
  player: GuildPlayer,
  t: Translator,
): Promise<void> {
  await player.resetFilters();
  await interaction.update(buildFiltersPanel(player, t)).catch(() => {});
}
