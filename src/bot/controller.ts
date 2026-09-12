import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type Message,
  type MessageActionRowComponentBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import type { GuildPlayer } from "@/bot/music/GuildPlayer";
import type { PlayerSnapshot, ResolvedTrack } from "@/bot/music/types";
import type { BotService } from "@/bot/bot";
import type { GuildData } from "@/db/models/Guild";
import type { Translator } from "@/i18n";
import { createTranslator, normalizeLocale } from "@/i18n";
import { getGuildSettings } from "@/db/repositories/guilds";
import {
  baseEmbed,
  EMOJI,
  errorEmbed,
  loopEmoji,
  loopLabel,
  nowPlayingEmbed,
  sourceEmoji,
  trackAddedEmbed,
  volumeBar,
} from "@/bot/lib/embeds";
import { isDJ, canControl } from "@/bot/lib/permissions";
import { formatDuration } from "@/lib/utils";
import { buildQueueMessage } from "@/bot/lib/queueview";
import { sendLyricsPaged } from "@/bot/lib/lyricsview";

type DJCheck = typeof isDJ;
type ControlCheck = typeof canControl;

/** A sendable component row (buttons and/or select menus). */
export type ComponentRow = ActionRowBuilder<MessageActionRowComponentBuilder>;

/** Any component interaction we can `update()`. */
export type ComponentInteraction = ButtonInteraction | StringSelectMenuInteraction;

async function translatorForGuild(guildId: string): Promise<Translator> {
  try {
    const settings = await getGuildSettings(guildId);
    return createTranslator(normalizeLocale(settings.language));
  } catch {
    return createTranslator("en");
  }
}

// ── Controller (Now Playing) message ─────────────────────────────

export function buildControllerComponents(player: GuildPlayer, t: Translator): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:ctrl:previous")
        .setEmoji(EMOJI.previous)
        .setLabel(t("music.ctrlPrevious"))
        .setStyle(ButtonStyle.Secondary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId(player.paused ? "slux:ctrl:resume" : "slux:ctrl:pause")
        .setEmoji(player.paused ? EMOJI.play : EMOJI.pause)
        .setLabel(player.paused ? t("music.ctrlResume") : t("music.ctrlPause"))
        .setStyle(ButtonStyle.Primary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:ctrl:skip")
        .setEmoji(EMOJI.skip)
        .setLabel(t("music.ctrlSkip"))
        .setStyle(ButtonStyle.Secondary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:ctrl:loop")
        .setEmoji(loopEmoji(player.repeat))
        .setLabel(t("music.ctrlLoop"))
        .setStyle(player.repeat === "off" ? ButtonStyle.Secondary : ButtonStyle.Success),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:ctrl:stop")
        .setEmoji(EMOJI.stop)
        .setLabel(t("music.ctrlStop"))
        .setStyle(ButtonStyle.Danger),
    );

  const row2 = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:ctrl:shuffle")
        .setEmoji(EMOJI.shuffle)
        .setLabel(t("music.ctrlShuffle"))
        .setStyle(player.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:ctrl:queue")
        .setEmoji(EMOJI.queue)
        .setLabel(t("music.ctrlQueue"))
        .setStyle(ButtonStyle.Primary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:ctrl:lyrics")
        .setEmoji(EMOJI.lyrics)
        .setLabel(t("music.ctrlLyrics"))
        .setStyle(ButtonStyle.Secondary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:ctrl:voldown")
        .setEmoji(EMOJI.volumeDown)
        .setLabel(t("music.ctrlVolDown"))
        .setStyle(ButtonStyle.Secondary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:ctrl:volup")
        .setEmoji(EMOJI.volume)
        .setLabel(t("music.ctrlVolUp"))
        .setStyle(ButtonStyle.Secondary),
    );

  return [row1, row2];
}

export function controllerEmbedFor(player: GuildPlayer, t: Translator): EmbedBuilder {
  if (!player.current) {
    return baseEmbed().setAuthor({ name: `${EMOJI.queue} ${t("music.queueEnded")}` });
  }
  return nowPlayingEmbed(t, player.current, {
    position: player.player.position,
    volume: player.volume,
    repeat: player.repeat,
    filters: player.snapshot().filters,
    paused: player.paused,
  });
}

/** Full now-playing message payload: embed + button rows. */
export function controllerPayload(player: GuildPlayer, t: Translator): {
  embeds: EmbedBuilder[];
  components: ComponentRow[];
} {
  return { embeds: [controllerEmbedFor(player, t)], components: buildControllerComponents(player, t) };
}

export async function handleControllerButton(
  interaction: ButtonInteraction,
  bot: BotService,
  player: GuildPlayer,
  t: Translator,
  settings: GuildData,
  isDJFn: DJCheck = isDJ,
  canControlFn: ControlCheck = canControl,
): Promise<void> {
  const action = interaction.customId.split(":")[2];
  const member = interaction.guild?.members.cache.get(interaction.user.id) ?? null;

  if (!canControlFn(member, settings, player)) {
    await interaction
      .reply({ embeds: [errorEmbed(t, t("music.djmodeActive"))], flags: MessageFlags.Ephemeral })
      .catch(() => {});
    return;
  }

  // Only voice listeners or DJs may use the controller
  const channel = player.voiceChannel;
  if (channel && !channel.members.has(interaction.user.id) && !isDJFn(member, settings, player)) {
    await interaction
      .reply({ embeds: [errorEmbed(t, t("common.notInSameVoice"))], flags: MessageFlags.Ephemeral })
      .catch(() => {});
    return;
  }

  switch (action) {
    case "pause":
      await player.pause();
      break;
    case "resume":
      await player.resume();
      break;
    case "skip":
      await player.skip();
      break;
    case "previous":
      await player.previous();
      break;
    case "loop":
      player.cycleRepeat();
      break;
    case "shuffle":
      player.toggleShuffle();
      break;
    case "voldown":
      await player.setVolume(player.volume - 10);
      break;
    case "volup":
      await player.setVolume(player.volume + 10);
      break;
    case "queue": {
      const { embed, components } = await buildQueueMessage(
        player,
        interaction.guild?.name ?? "",
        1,
        t,
        interaction.guild?.iconURL() ?? undefined,
      );
      await interaction
        .reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral })
        .catch(() => {});
      return;
    }
    case "lyrics": {
      const track = player.current;
      if (!track) {
        await interaction
          .reply({ embeds: [errorEmbed(t, t("common.noPlayer"))], flags: MessageFlags.Ephemeral })
          .catch(() => {});
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
      await sendLyricsPaged({
        music: bot.music,
        pagination: bot.pagination,
        player,
        t,
        track,
        send: async (payload) => {
          await interaction.editReply(payload as never).catch(() => {});
          return null;
        },
      });
      return;
    }
    case "stop": {
      await bot.music.destroyPlayer(player.guildId, "stopped");
      await interaction
        .update({
          embeds: [
            baseEmbed()
              .setAuthor({ name: `${EMOJI.stop} ${t("music.stoppedTitle")}` })
              .setDescription(t("music.stopped")),
          ],
          components: [],
        })
        .catch(() => {});
      return;
    }
  }

  await interaction.update(controllerPayload(player, t)).catch(() => {});
}

// ── Now Playing message lifecycle ────────────────────────────────

/** Keeps one live controller message per guild, refreshed on track start. */
export class NowPlayingManager {
  private messages = new Map<string, Message>();
  private states = new Map<string, { paused: boolean; repeat: string; shuffle: boolean }>();
  private tickers = new Map<string, NodeJS.Timeout>();

  private stateOf(player: GuildPlayer) {
    return { paused: player.paused, repeat: player.repeat, shuffle: player.shuffle };
  }

  async handleTrackStart(bot: BotService, guildId: string): Promise<void> {
    const player = bot.music.getPlayer(guildId);
    if (!player?.current) return;
    const channel = player.textChannel;
    if (!channel || !("send" in channel) || typeof channel.send !== "function") return;
    await this.disableMessage(guildId);
    try {
      const t = await translatorForGuild(guildId);
      const message = await channel.send(controllerPayload(player, t));
      this.messages.set(guildId, message);
      this.states.set(guildId, this.stateOf(player));
      this.startTicker(bot, guildId, message);
    } catch {
      /* missing send permissions */
    }
  }

  /** Live progress: edit the now-playing embed every 5s so the playback bar
   *  stays in sync with the dashboard without any button presses. */
  private startTicker(bot: BotService, guildId: string, message: Message): void {
    this.stopTicker(guildId);
    const timer = setInterval(() => {
      void (async () => {
        const player = bot.music.getPlayer(guildId);
        if (!player?.current) {
          this.stopTicker(guildId);
          return;
        }
        // While paused the position is frozen — skip the edit to save calls.
        if (player.paused) return;
        try {
          const t = await translatorForGuild(guildId);
          await message.edit({ embeds: [controllerEmbedFor(player, t)] });
        } catch {
          // Message deleted or rate-limited — stop ticking for this guild.
          this.stopTicker(guildId);
        }
      })();
    }, 5_000);
    timer.unref?.();
    this.tickers.set(guildId, timer);
  }

  private stopTicker(guildId: string): void {
    const timer = this.tickers.get(guildId);
    if (timer) {
      clearInterval(timer);
      this.tickers.delete(guildId);
    }
  }

  /** Cheap sync — refreshes the controller buttons when pause/loop/shuffle changes. */
  handleSnapshot(bot: BotService, snapshot: PlayerSnapshot): void {
    const message = this.messages.get(snapshot.guildId);
    if (!message) return;
    const state = { paused: snapshot.paused, repeat: snapshot.repeat, shuffle: snapshot.shuffle };
    const prev = this.states.get(snapshot.guildId);
    if (prev && prev.paused === state.paused && prev.repeat === state.repeat && prev.shuffle === state.shuffle) {
      return;
    }
    this.states.set(snapshot.guildId, state);
    if (!snapshot.track) {
      void this.disableMessage(snapshot.guildId);
      return;
    }
    const player = bot.music.getPlayer(snapshot.guildId);
    if (!player) return;
    void (async () => {
      const t = await translatorForGuild(snapshot.guildId);
      await message.edit({ components: buildControllerComponents(player, t) }).catch(() => {});
    })();
  }

  async handlePlayerDestroy(guildId: string): Promise<void> {
    await this.disableMessage(guildId);
  }

  async disableMessage(guildId: string): Promise<void> {
    this.stopTicker(guildId);
    const message = this.messages.get(guildId);
    this.messages.delete(guildId);
    this.states.delete(guildId);
    if (!message) return;
    await message.edit({ components: disableAllRows(message) }).catch(() => {});
  }
}

// ── Component row utilities ──────────────────────────────────────

/** Read the components of a message row regardless of cache state. */
function rowComponentsOf(row: unknown): unknown[] {
  if (!row || typeof row !== "object") return [];
  return (row as { components?: unknown[] }).components ?? [];
}

function componentCustomId(component: unknown): string | undefined {
  if (!component || typeof component !== "object") return undefined;
  const obj = component as { customId?: string; custom_id?: string };
  return obj.customId ?? obj.custom_id;
}

/** Rebuild a message's rows with every button disabled. */
export function disableAllRows(message: Message): ComponentRow[] {
  return message.components.map((row) => {
    const builder = new ActionRowBuilder<ButtonBuilder>();
    for (const component of rowComponentsOf(row)) {
      builder.addComponents(
        ButtonBuilder.from(component as never).setDisabled(true),
      );
    }
    return builder;
  });
}

/** Disable only the rows whose components match a predicate; others pass through. */
export function disableRowsWhere(
  message: Message,
  predicate: (customId: string) => boolean,
): unknown[] {
  return message.components.map((row) => {
    const comps = rowComponentsOf(row);
    const matches = comps.some((c) => {
      const id = componentCustomId(c);
      return id !== undefined && predicate(id);
    });
    if (!matches) return row;
    const builder = new ActionRowBuilder<ButtonBuilder>();
    for (const component of comps) {
      builder.addComponents(ButtonBuilder.from(component as never).setDisabled(true));
    }
    return builder;
  });
}

// ── Generic button pagination ────────────────────────────────────

export interface PagedView {
  totalPages: number;
  render: (page: number) => { embeds: EmbedBuilder[]; rows?: ComponentRow[] };
  message?: Message | null;
  timeout: NodeJS.Timeout;
}

export function buildPaginationRow(
  sessionId: string,
  page: number,
  totalPages: number,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`slux:pg:${sessionId}:f`)
        .setEmoji("⏪")
        .setLabel("1")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`slux:pg:${sessionId}:${page - 1}`)
        .setEmoji("◀")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 1),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`slux:pg:${sessionId}:x`)
        .setLabel(`${page} / ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`slux:pg:${sessionId}:${page + 1}`)
        .setEmoji("▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`slux:pg:${sessionId}:l`)
        .setEmoji("⏩")
        .setLabel(String(totalPages))
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages),
    );
  return row;
}

/** Session-based pagination used by lyrics, playlists, help, … */
export class PaginationManager {
  private sessions = new Map<string, PagedView>();
  private seq = 0;

  create(totalPages: number, render: PagedView["render"], ttlMs = 300_000): string {
    const id = `${Date.now().toString(36)}${(this.seq++).toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const session: PagedView = {
      totalPages: Math.max(1, totalPages),
      render,
      timeout: null as never,
    };
    session.timeout = setTimeout(() => {
      this.sessions.delete(id);
      void session.message?.edit({ components: [] }).catch(() => {});
    }, ttlMs);
    session.timeout.unref?.();
    this.sessions.set(id, session);
    if (this.sessions.size > 100) {
      const oldest = this.sessions.keys().next().value;
      if (oldest) {
        clearTimeout(this.sessions.get(oldest)?.timeout);
        this.sessions.delete(oldest);
      }
    }
    return id;
  }

  attach(id: string, message: Message | null): void {
    const session = this.sessions.get(id);
    if (session) session.message = message;
  }

  /** Builds the message payload for a page: render rows + pagination row. */
  build(
    id: string,
    page = 1,
  ): { embeds: EmbedBuilder[]; components: ComponentRow[] } {
    const session = this.sessions.get(id);
    if (!session) return { embeds: [], components: [] };
    const safePage = Math.min(Math.max(1, page), session.totalPages);
    const view = session.render(safePage);
    const rows = [...(view.rows ?? [])];
    if (session.totalPages > 1) rows.push(buildPaginationRow(id, safePage, session.totalPages));
    return { embeds: view.embeds, components: rows };
  }

  async handle(interaction: ButtonInteraction, id: string, token: string, t: Translator): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) {
      const disabled = disableRowsWhere(interaction.message, (customId) => customId.startsWith("slux:pg:"));
      await interaction
        .reply({
          embeds: [errorEmbed(t, t("common.viewExpired"))],
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
      await interaction.update({ components: disabled as never }).catch(() => {});
      return;
    }

    let page: number;
    if (token === "f") page = 1;
    else if (token === "l") page = session.totalPages;
    else page = parseInt(token, 10) || 1;
    page = Math.min(Math.max(1, page), session.totalPages);

    const view = session.render(page);
    const rows = [...(view.rows ?? [])];
    if (session.totalPages > 1) rows.push(buildPaginationRow(id, page, session.totalPages));
    await interaction.update({ embeds: view.embeds, components: rows }).catch(() => {});
  }
}

// ── Search result selection ──────────────────────────────────────

export function buildSearchSelectComponents(
  t: Translator,
  sessionId: string,
  tracks: ResolvedTrack[],
): ComponentRow[] {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`slux:sel:${sessionId}`)
    .setPlaceholder(t("music.selectPlaceholder"))
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      tracks.slice(0, 25).map((track, i) => ({
        label: track.title.length > 100 ? `${track.title.slice(0, 97)}...` : track.title,
        description: `${track.author} • ${track.isStream ? "LIVE" : formatDuration(track.length)}`.slice(0, 100),
        value: String(i),
        emoji: sourceEmoji(track.sourceName),
      })),
    );

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
  // Max 4 numbered buttons + the cancel button = 5 components per row
  // (Discord hard-rejects rows with more than 5: BASE_TYPE_BAD_LENGTH).
  const row2 = new ActionRowBuilder<ButtonBuilder>();
  for (let i = 0; i < Math.min(4, tracks.length); i++) {
    row2.addComponents(
      new ButtonBuilder()
        .setCustomId(`slux:sel:${sessionId}:${i}`)
        .setLabel(String(i + 1))
        .setStyle(ButtonStyle.Primary),
    );
  }
  row2.addComponents(
    new ButtonBuilder()
      .setCustomId(`slux:sel:${sessionId}:cancel`)
      .setLabel(t("music.cancelButton"))
      .setEmoji("✖️")
      .setStyle(ButtonStyle.Danger),
  );
  return [row1, row2];
}

export async function handleSearchSelect(
  interaction: ComponentInteraction,
  bot: BotService,
  player: GuildPlayer,
  t: Translator,
  settings: GuildData,
  rest: string[],
  value?: string,
): Promise<void> {
  const indexRaw = value ?? rest[1];
  if (indexRaw === "cancel") {
    await interaction
      .update({
        embeds: [
          baseEmbed().setAuthor({ name: `${EMOJI.error} ${t("common.cancelled")}` }),
        ],
        components: [],
      })
      .catch(() => {});
    return;
  }

  const member = interaction.guild?.members.cache.get(interaction.user.id) ?? null;
  if (!canControl(member, settings, player)) {
    await interaction
      .reply({ embeds: [errorEmbed(t, t("music.djmodeActive"))], flags: MessageFlags.Ephemeral })
      .catch(() => {});
    return;
  }

  const searchStore = bot.searchSessions;
  const session = searchStore.get(interaction.message.id);
  if (!session) {
    await interaction
      .update({
        embeds: [errorEmbed(t, t("common.timeUp"))],
        components: [],
      })
      .catch(() => {});
    return;
  }

  const index = parseInt(indexRaw ?? "0", 10);
  const track = session.tracks[index];
  if (!track) return;

  searchStore.delete(interaction.message.id);
  clearTimeout(session.timeout);

  const wasEmpty = !player.current;
  player.enqueue(track, wasEmpty ? undefined : player.queue.length);
  if (wasEmpty) await player.startIfIdle();

  await interaction
    .update({
      embeds: [
        trackAddedEmbed(t, track, {
          position: wasEmpty ? 1 : player.queue.length,
          queueLength: player.queue.length,
        }),
      ],
      components: [],
    })
    .catch(() => {});
}

export interface SearchSession {
  tracks: ResolvedTrack[];
  timeout: NodeJS.Timeout;
  userId: string;
}

// ── Quick action views (loop / volume / toggles) ─────────────────

export function loopRow(t: Translator, player: GuildPlayer): ComponentRow[] {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:loop:off")
        .setLabel(t("music.loopModeOff"))
        .setEmoji(EMOJI.loopOff)
        .setStyle(player.repeat === "off" ? ButtonStyle.Success : ButtonStyle.Secondary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:loop:track")
        .setLabel(t("music.loopModeTrack"))
        .setEmoji(EMOJI.loopTrack)
        .setStyle(player.repeat === "track" ? ButtonStyle.Success : ButtonStyle.Secondary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:loop:queue")
        .setLabel(t("music.loopModeQueue"))
        .setEmoji(EMOJI.loop)
        .setStyle(player.repeat === "queue" ? ButtonStyle.Success : ButtonStyle.Secondary),
    );
  return [row];
}

export function loopStatusEmbed(t: Translator, player: GuildPlayer): EmbedBuilder {
  const embed = baseEmbed()
    .setAuthor({ name: `${loopEmoji(player.repeat)} ${t("music.loopTitle")}` })
    .setDescription(t("music.loopCurrent", { mode: `**${loopLabel(t, player.repeat)}**` }));
  const track = player.current;
  if (track) {
    embed.addFields({
      name: EMOJI.nowPlaying,
      value: `${EMOJI.music} [${track.title}](${track.uri || "https://discord.com"}) — **${track.author}**`,
      inline: false,
    });
    if (track.artwork) embed.setThumbnail(track.artwork);
  }
  return embed;
}

export async function handleLoopButton(
  interaction: ButtonInteraction,
  player: GuildPlayer,
  t: Translator,
  modeRaw: string,
): Promise<void> {
  if (modeRaw === "off" || modeRaw === "track" || modeRaw === "queue") {
    await player.setRepeat(modeRaw);
  }
  await interaction
    .update({ embeds: [loopStatusEmbed(t, player)], components: loopRow(t, player) })
    .catch(() => {});
}

export function volumeRow(t: Translator, player: GuildPlayer): ComponentRow[] {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:vol:-10")
        .setLabel(t("music.volDown"))
        .setEmoji(EMOJI.volumeDown)
        .setStyle(ButtonStyle.Secondary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:vol:mute")
        .setLabel(t("music.volMute"))
        .setEmoji(EMOJI.volumeMute)
        .setStyle(player.volume === 0 ? ButtonStyle.Danger : ButtonStyle.Secondary),
    )
    .addComponents(
      new ButtonBuilder()
        .setCustomId("slux:vol:10")
        .setLabel(t("music.volUp"))
        .setEmoji(EMOJI.volume)
        .setStyle(ButtonStyle.Secondary),
    );
  return [row];
}

export function volumeStatusEmbed(t: Translator, player: GuildPlayer): EmbedBuilder {
  const icon = player.volume === 0 ? EMOJI.volumeMute : player.volume < 50 ? EMOJI.volumeDown : EMOJI.volume;
  return baseEmbed()
    .setAuthor({ name: `${icon} ${t("music.volumeTitle")}` })
    .setDescription(`**${player.volume}%**\n\`${volumeBar(player.volume)}\``);
}

export async function handleVolumeButton(
  interaction: ButtonInteraction,
  player: GuildPlayer,
  t: Translator,
  token: string,
): Promise<void> {
  if (token === "mute") {
    await player.setVolume(player.volume === 0 ? 100 : 0);
  } else {
    const delta = parseInt(token, 10) || 0;
    await player.setVolume(player.volume + delta);
  }
  await interaction
    .update({ embeds: [volumeStatusEmbed(t, player)], components: volumeRow(t, player) })
    .catch(() => {});
}

export type ToggleKey = "autoplay" | "247" | "djmode";

export function toggleRow(t: Translator, key: ToggleKey, state: boolean): ComponentRow[] {
  const labels: Record<ToggleKey, string> = {
    autoplay: t("music.autoplayLabel"),
    "247": "24/7",
    djmode: t("music.djmodeLabel"),
  };
  const emojis: Record<ToggleKey, string> = {
    autoplay: EMOJI.autoplay,
    "247": EMOJI.infinity,
    djmode: EMOJI.dj,
  };
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`slux:tgl:${key}`)
        .setLabel(`${labels[key]}: ${state ? t("common.on") : t("common.off")}`)
        .setEmoji(emojis[key])
        .setStyle(state ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
  ];
}

export function toggleStatusEmbed(t: Translator, key: ToggleKey, state: boolean): EmbedBuilder {
  const meta: Record<ToggleKey, { emoji: string; title: string; on: string; off: string }> = {
    autoplay: {
      emoji: EMOJI.autoplay,
      title: t("music.autoplayLabel"),
      on: t("music.autoplayOn"),
      off: t("music.autoplayOff"),
    },
    "247": {
      emoji: EMOJI.infinity,
      title: "24/7",
      on: t("music.stayOn"),
      off: t("music.stayOff"),
    },
    djmode: {
      emoji: EMOJI.dj,
      title: t("music.djmodeLabel"),
      on: t("music.djmodeOn"),
      off: t("music.djmodeOff"),
    },
  };
  const m = meta[key];
  return baseEmbed(state ? 0x22c55e : 0x8b5cf6)
    .setAuthor({ name: `${m.emoji} ${m.title}` })
    .setDescription(
      `${state ? EMOJI.ok : EMOJI.error} **${state ? t("common.enabled") : t("common.disabled")}**\n\n${state ? m.on : m.off}`,
    );
}

export async function handleToggleButton(
  interaction: ButtonInteraction,
  player: GuildPlayer,
  t: Translator,
  keyRaw: string,
): Promise<void> {
  const key = (["autoplay", "247", "djmode"] as const).includes(keyRaw as ToggleKey)
    ? (keyRaw as ToggleKey)
    : null;
  if (!key) return;
  if (key === "autoplay") player.autoplay = !player.autoplay;
  if (key === "247") player.stayInChannel = !player.stayInChannel;
  if (key === "djmode") player.djMode = !player.djMode;
  player.emit();
  await interaction
    .update({ embeds: [toggleStatusEmbed(t, key, getPlayerToggle(player, key))], components: toggleRow(t, key, getPlayerToggle(player, key)) })
    .catch(() => {});
}

export function getPlayerToggle(player: GuildPlayer, key: ToggleKey): boolean {
  if (key === "autoplay") return player.autoplay;
  if (key === "247") return player.stayInChannel;
  return player.djMode;
}
