import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type EmbedBuilder,
} from "discord.js";
import type { ComponentRow } from "@/bot/controller";
import type { GuildPlayer } from "@/bot/music/GuildPlayer";
import type { Translator } from "@/i18n";
import {
  baseEmbed,
  EMOJI,
  errorEmbed,
  loopEmoji,
  loopLabel,
  progressBar,
  sourceEmoji,
  trackLine,
} from "@/bot/lib/embeds";
import { formatDuration } from "@/lib/utils";

const PER_PAGE = 10;

export async function buildQueueMessage(
  player: GuildPlayer | undefined,
  guildName: string,
  page: number,
  t: Translator,
  iconUrl?: string,
): Promise<{
  embed: EmbedBuilder;
  components: ComponentRow[];
}> {
  if (!player || !player.current) {
    return { embed: errorEmbed(t, t("common.noPlayer")), components: [] };
  }
  const totalPages = Math.max(1, Math.ceil(player.queue.length / PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const items = player.queue.slice(start, start + PER_PAGE);

  const current = player.current;
  const nowPlaying =
    `${EMOJI.nowPlaying} **[${current.title}](${current.uri || "https://discord.com"})**\n` +
    `👤 **${current.author}** ${sourceEmoji(current.sourceName)}\n` +
    (current.isStream ? `🔴 ${t("music.live")}` : progressBar(player.player.position, current.length) || "");

  const embed = baseEmbed(0x6366f1)
    .setAuthor({ name: `${EMOJI.queue} ${t("music.queueTitle", { guild: guildName })}`, iconURL: iconUrl })
    .setDescription(nowPlaying)
    .setFooter({
      text: `${t("common.page", { current: safePage, total: totalPages })} • ${t("music.queueFooter", {
        count: player.queue.length,
        duration: formatDuration(player.queue.reduce((a, tr) => a + tr.length, 0)),
      })} • ${loopEmoji(player.repeat)} ${loopLabel(t, player.repeat)}`,
    });

  if (current.artwork) embed.setThumbnail(current.artwork);

  if (items.length === 0) {
    embed.addFields({
      name: `${EMOJI.cd} ${t("music.queueUpNext")}`,
      value: `*${t("common.queueEmpty")}*`,
      inline: false,
    });
  } else {
    embed.addFields({
      name: `${EMOJI.cd} ${t("music.queueUpNext")}`,
      value: items.map((tr, i) => trackLine(tr, start + i + 1)).join("\n").slice(0, 1024),
      inline: false,
    });
  }

  const components: ComponentRow[] = [];
  if (totalPages > 1) {
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`slux:q:1`)
          .setEmoji("⏪")
          .setLabel("1")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage <= 1),
      )
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`slux:q:${safePage - 1}`)
          .setEmoji("◀")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage <= 1),
      )
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`slux:q:${safePage}`)
          .setLabel(`${safePage} / ${totalPages}`)
          .setEmoji("🔄")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(false),
      )
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`slux:q:${safePage + 1}`)
          .setEmoji("▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= totalPages),
      )
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`slux:q:${totalPages}`)
          .setEmoji("⏩")
          .setLabel(String(totalPages))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= totalPages),
      );
    components.push(row);

    // Page jump dropdown when there are several pages
    if (totalPages > 2) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId("slux:qsel")
        .setPlaceholder(t("music.queueJumpTo"))
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          Array.from({ length: Math.min(25, totalPages) }, (_, i) => ({
            label: t("music.queuePageOption", { page: i + 1 }),
            value: String(i + 1),
          })),
        );
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
    }
  }
  return { embed, components };
}
