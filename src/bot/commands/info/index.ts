import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type EmbedBuilder } from "discord.js";
import type { BotCommand, CommandContext } from "@/bot/commands/types";
import { baseEmbed, dashboardBase, errorEmbed, EMOJI } from "@/bot/lib/embeds";
import { formatDurationLong, formatNumber } from "@/lib/utils";
import { buildHelpOverview, inviteUrl } from "@/bot/lib/helpview";

export const helpCommand: BotCommand = {
  name: "help",
  descriptionKey: "commands.help.description",
  category: "info",
  aliases: ["h", "commands"],
  async execute(ctx: CommandContext) {
    const view = buildHelpOverview(ctx.t, ctx.prefix);
    await ctx.reply(view);
  },
};

export const pingCommand: BotCommand = {
  name: "ping",
  descriptionKey: "commands.ping.description",
  category: "info",
  aliases: ["latency"],
  async execute(ctx: CommandContext) {
    await ctx.defer();
    const ws = Math.round(ctx.client.ws.ping);
    const node = ctx.client.shoukaku.getIdealNode();
    const sentAt = Date.now();
    await ctx.editReply({ content: "🏓" }).catch(() => {});
    const roundtrip = Date.now() - sentAt;
    const latency = Math.max(ws, roundtrip);
    const color = latency < 100 ? 0x22c55e : latency < 250 ? 0xf59e0b : 0xef4444;
    const embed: EmbedBuilder = baseEmbed(color)
      .setAuthor({ name: `${EMOJI.rocket} ${ctx.t("info.pingTitle")}` })
      .setDescription(
        `${latency < 100 ? "🟢" : latency < 250 ? "🟡" : "🔴"} ${ctx.t("info.pingStatus")}`,
      )
      .addFields(
        { name: `📡 ${ctx.t("info.pingWebsocket")}`, value: `\`${ws}ms\``, inline: true },
        { name: `🔁 ${ctx.t("info.pingRoundtrip")}`, value: `\`${roundtrip}ms\``, inline: true },
        {
          name: `🎚️ ${ctx.t("info.statsNodePenalties")}`,
          value: node ? `\`${node.penalties}\`` : "—",
          inline: true,
        },
      );
    await ctx.editReply({ embeds: [embed], content: "" });
  },
};

export const statsCommand: BotCommand = {
  name: "stats",
  descriptionKey: "commands.stats.description",
  category: "info",
  aliases: [],
  async execute(ctx: CommandContext) {
    const stats = ctx.client.music.stats();
    let users = 0;
    for (const guild of ctx.client.guilds.cache.values()) {
      users += guild.memberCount ?? 0;
    }
    const memory = process.memoryUsage().heapUsed / 1024 / 1024;
    const embed = baseEmbed()
      .setAuthor({
        name: `${EMOJI.music} ${ctx.t("info.statsTitle")}`,
        iconURL: ctx.client.user?.displayAvatarURL({ size: 64 }),
      })
      .addFields(
        { name: `🖥️ ${ctx.t("info.statsServers")}`, value: `\`${formatNumber(ctx.client.guilds.cache.size)}\``, inline: true },
        { name: `🎧 ${ctx.t("info.statsPlayers")}`, value: `\`${formatNumber(stats.players)}\``, inline: true },
        { name: `👥 ${ctx.t("info.statsUsers")}`, value: `\`${formatNumber(users)}\``, inline: true },
        { name: `⏱️ ${ctx.t("info.statsUptime")}`, value: `\`${formatDurationLong(process.uptime() * 1000)}\``, inline: true },
        { name: `💾 ${ctx.t("info.statsMemory")}`, value: `\`${memory.toFixed(1)} MB\``, inline: true },
        {
          name: `🎚️ ${ctx.t("info.statsNode")}`,
          value: stats.nodeStats
            ? `\`${stats.nodeStats.players}\` / \`${stats.nodeStats.playingPlayers}\` ▶️`
            : "—",
          inline: true,
        },
      )
      .setFooter({ text: `Slux • ${ctx.client.user?.tag ?? ""}` });
    if (ctx.client.user) {
      embed.setThumbnail(ctx.client.user.displayAvatarURL({ size: 128 }));
    }
    await ctx.reply({ embeds: [embed] });
  },
};

/** Developer credits — showcases SHM's work. */
export const developerCommand: BotCommand = {
  name: "developer",
  descriptionKey: "commands.developer.description",
  category: "info",
  aliases: ["dev", "shm", "credits"],
  async execute(ctx: CommandContext) {
    const dashboard = dashboardBase();
    const embed = baseEmbed()
      .setAuthor({ name: `💖 ${ctx.t("info.developerTitle")}` })
      .setDescription(ctx.t("info.developerDescription"))
      .addFields(
        { name: "👨‍💻 Developer", value: `**SHM** — ${ctx.t("info.developerRole")}`, inline: true },
        { name: "▶️ YouTube", value: "[@Letzforge](https://youtube.com/@Letzforge)", inline: true },
        { name: "💬 Discord", value: "**shahrib** • [Support server](https://discord.gg/NC4YdDQj5u)", inline: true },
        {
          name: `✨ ${ctx.t("info.developerWorkTitle")}`,
          value: ctx.t("info.developerWork"),
          inline: false,
        },
      )
      .setFooter({
        text: `${ctx.t("info.developerFooter")} • Slux`,
        iconURL: ctx.client.user?.displayAvatarURL({ size: 64 }),
      });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Subscribe on YouTube")
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Link)
        .setURL("https://youtube.com/@Letzforge"),
      new ButtonBuilder()
        .setLabel("Join Discord")
        .setEmoji("💬")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/NC4YdDQj5u"),
    );
    if (dashboard) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel(ctx.t("info.dashboardButton"))
          .setEmoji("🖥️")
          .setStyle(ButtonStyle.Link)
          .setURL(dashboard),
      );
    }

    await ctx.reply({ embeds: [embed], components: [row] });
  },
};

/** Live status of every configured Lavalink node (main + backup). */
export const nodesCommand: BotCommand = {  name: "nodes",
  descriptionKey: "commands.nodes.description",
  category: "info",
  aliases: ["node", "lavalink"],
  async execute(ctx: CommandContext) {
    const nodes = [...ctx.client.shoukaku.nodes.values()];
    if (nodes.length === 0) {
      await ctx.reply({ embeds: [errorEmbed(ctx.t, ctx.t("music.engineNotReady"))] });
      return;
    }

    const statusOf = (state: number): string => {
      switch (state) {
        case 1:
          return `🟢 ${ctx.t("info.nodeConnected")}`;
        case 0:
          return `🟡 ${ctx.t("info.nodeConnecting")}`;
        case 2:
          return `🟠 ${ctx.t("info.nodeDisconnecting")}`;
        default:
          return `🔴 ${ctx.t("info.nodeDisconnected")}`;
      }
    };

    const fields = nodes.map((node) => {
      const stats = node.stats;
      const cpu = stats ? `${(stats.cpu.systemLoad * 100).toFixed(1)}%` : "—";
      const players = stats ? `${stats.players} (${stats.playingPlayers} ▶️)` : "—";
      return {
        name: `${statusOf(node.state).split(" ")[0]} ${node.name}`,
        value:
          `${statusOf(node.state).slice(statusOf(node.state).indexOf(" ") + 1)}\n` +
          `🎚️ ${ctx.t("info.nodePenalties")}: \`${node.penalties}\`\n` +
          `🎧 ${ctx.t("info.nodePlayers")}: \`${players}\`\n` +
          `💾 ${ctx.t("info.nodeCpu")}: \`${cpu}\``,
        inline: true,
      };
    });

    const ideal = ctx.client.shoukaku.getIdealNode();
    const embed = baseEmbed()
      .setAuthor({ name: `🎚️ ${ctx.t("info.nodesTitle")}` })
      .setDescription(
        ideal
          ? ctx.t("info.nodesActive", { name: `**${ideal.name}**` })
          : ctx.t("music.engineNotReady"),
      )
      .addFields(fields)
      .setFooter({ text: `Slux • ${nodes.length} node(s)` });
    await ctx.reply({ embeds: [embed] });
  },
};

export const inviteCommand: BotCommand = {  name: "invite",
  descriptionKey: "commands.invite.description",
  category: "info",
  aliases: ["add"],
  async execute(ctx: CommandContext) {
    const url = inviteUrl();
    const embed = baseEmbed()
      .setAuthor({ name: `${EMOJI.rocket} ${ctx.t("info.inviteTitle")}` })
      .setDescription(ctx.t("info.inviteDescription"))
      .setURL(url);
    await ctx.reply({ embeds: [embed] });
  },
};

export const aboutCommand: BotCommand = {
  name: "about",
  descriptionKey: "commands.about.description",
  category: "info",
  aliases: ["info", "botinfo"],
  async execute(ctx: CommandContext) {
    const embed = baseEmbed()
      .setAuthor({
        name: `${EMOJI.music} ${ctx.t("info.aboutTitle")}`,
        iconURL: ctx.client.user?.displayAvatarURL({ size: 64 }),
      })
      .setDescription(ctx.t("info.aboutDescription"))
      .addFields(
        { name: `🎵 ${ctx.t("info.aboutSources")}`, value: "🟢 Spotify • 🔴 YouTube • 🟠 SoundCloud • 🟣 Deezer • 🍎 Apple Music • 🌊 Tidal", inline: false },
        { name: `🎛️ ${ctx.t("info.helpFields.filters")}`, value: "🔊 Bassboost • 🚀 Nightcore • 🌴 Vaporwave • 🌀 8D • 🎤 Karaoke • 🎚️ EQ", inline: false },
        { name: `✨ ${ctx.t("info.aboutFeatures")}`, value: "📝 Synced lyrics • 📜 Queue controls • 🖥️ Web dashboard • 🌐 6 languages • ♾️ 24/7 mode", inline: false },
      )
      .setFooter({ text: ctx.t("info.aboutFooter") });
    if (ctx.client.user) {
      embed.setThumbnail(ctx.client.user.displayAvatarURL({ size: 256 }));
    }
    await ctx.reply({ embeds: [embed] });
  },
};
