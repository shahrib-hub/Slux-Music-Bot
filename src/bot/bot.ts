import { EventEmitter } from "node:events";
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  PermissionFlagsBits,
  type ApplicationCommandData,
  type ApplicationCommandOptionData,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  Collection,
  type Guild,
  type Interaction,
  type Message,
  type RepliableInteraction,
  type TextBasedChannel,
  type TextChannel,
  type VoiceState,
} from "discord.js";
import { Shoukaku, Connectors } from "shoukaku";
import { MusicManager } from "@/bot/music/MusicManager";
import type { PlayerSnapshot, ResolvedTrack } from "@/bot/music/types";
import { commandsRegistry } from "@/bot/commands";
import type { BotCommand, CommandContext, CommandOptionSpec } from "@/bot/commands/types";
import { getGuildSettings, invalidateGuildCache } from "@/db/repositories/guilds";
import { isBlacklisted } from "@/db/models/Blacklist";
import { createTranslator, LOCALES, normalizeLocale, type Locale, type Translator } from "@/i18n";
import { getEnv } from "@/lib/env";
import { lavalinkNodeOptions } from "@/lib/lavalink";
import { tokenize } from "@/bot/lib/parse";
import { isDJ, canControl, botChannelAllowed, manageGuild } from "@/bot/lib/permissions";
import { errorEmbed, BRAND_COLOR, baseEmbed } from "@/bot/lib/embeds";
import { GuildModel } from "@/db/models/Guild";
import { buildQueueMessage } from "@/bot/lib/queueview";
import {
  handleControllerButton,
  handleSearchSelect,
  handleLoopButton,
  handleVolumeButton,
  handleToggleButton,
  NowPlayingManager,
  PaginationManager,
  type SearchSession,
} from "@/bot/controller";
import { handleHelpSelect, buildMentionHelp } from "@/bot/lib/helpview";
import { buildFiltersPanel, handleFilterSelect, handleFilterReset } from "@/bot/lib/filtersview";

type BotBusMap = {
  snapshot: [PlayerSnapshot];
  trackStart: [{ guildId: string; track: ResolvedTrack }];
  playerDestroy: [{ guildId: string; reason: string }];
  ready: [];
};

const COOLDOWN_MS = 3000;

export class BotService {
  readonly client: Client;
  readonly music: MusicManager;
  readonly bus = new EventEmitter<BotBusMap>();
  readonly commands: Collection<string, BotCommand> = new Collection<string, BotCommand>();
  readonly startedAt = Date.now();
  readonly isDJ = isDJ;
  readonly canControl = canControl;
  readonly npManager = new NowPlayingManager();
  readonly pagination = new PaginationManager();

  private cooldowns = new Map<string, number>();
  private ready = false;
  readonly searchSessions = new Map<string, SearchSession>();

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });

    // Node connection settings come from the LAVALINK_* env block:
    // the main 3rd-party node plus an optional backup with automatic
    // failover, optionally over TLS.
    const nodes = lavalinkNodeOptions();

    const shoukaku = new Shoukaku(new Connectors.DiscordJS(this.client), nodes, {
      resume: true,
      resumeTimeout: 30,
      resumeByLibrary: true,
      // ~50 minutes of retries: Lavalink may still be booting (first run
      // downloads LavaSrc/LavaSearch/LavaLyrics plugins) when the bot logs in.
      reconnectTries: 300,
      reconnectInterval: 10000,
      restTimeout: 15000,
      moveOnDisconnect: true,
      userAgent: "Slux/1.0 (https://slux.example)",
    });

    this.client.shoukaku = shoukaku;
    this.music = new MusicManager(this.client, {
      onSnapshot: (snapshot) => this.bus.emit("snapshot", snapshot),
      onTrackStart: (guildId, track) => this.bus.emit("trackStart", { guildId, track }),
      onDestroy: (guildId, reason) => this.bus.emit("playerDestroy", { guildId, reason }),
    });
    this.client.music = this.music;

    shoukaku.on("ready", (name) => console.log(`[slux] Lavalink node "${name}" ready`));
    shoukaku.on("error", (_name, error) =>
      console.error("[slux] Lavalink error:", error?.message ?? String(error)),
    );
    shoukaku.on("reconnecting", (name, left) =>
      console.warn(`[slux] Reconnecting to "${name}" (${left} tries left)`),
    );
    shoukaku.on("disconnect", (name, count) =>
      console.warn(`[slux] Disconnected from "${name}" (${count} reconnects)`),
    );

    // Live "now playing" controller message with button controls
    this.bus.on("trackStart", ({ guildId }) => {
      void this.npManager.handleTrackStart(this, guildId);
    });
    this.bus.on("playerDestroy", ({ guildId }) => {
      void this.npManager.handlePlayerDestroy(guildId);
    });
    this.bus.on("snapshot", (snapshot) => {
      this.npManager.handleSnapshot(this, snapshot);
    });
    // Keep the voice channel status in sync with the current track
    this.bus.on("trackStart", ({ guildId, track }) => {
      void this.music.setVoiceChannelStatus(
        guildId,
        `🎵 ${track.title} • ${track.author}`.slice(0, 500),
      );
    });

    this.loadCommands();
    this.bindEvents();
  }

  private loadCommands(): void {
    for (const command of commandsRegistry) {
      this.commands.set(command.name, command);
    }
    console.log(`[slux] Loaded ${this.commands.size} commands`);
  }

  async login(): Promise<void> {
    const env = getEnv();
    await this.client.login(env.DISCORD_TOKEN);
  }

  async shutdown(): Promise<void> {
    for (const guildId of [...this.music.players.keys()]) {
      await this.music.destroyPlayer(guildId, "shutdown");
    }
    await this.client.destroy();
  }

  // ── Event wiring ─────────────────────────────────────────────────

  private bindEvents(): void {
    this.client.once(Events.ClientReady, async (client) => {
      console.log(`[slux] Logged in as ${client.user.tag} (${client.guilds.cache.size} guilds)`);
      await this.registerSlashCommands();
      this.ready = true;
      this.bus.emit("ready");
    });

    this.client.on(Events.InteractionCreate, (interaction) => {
      this.handleInteraction(interaction).catch((err) =>
        this.logEventError("interactionCreate", err),
      );
    });

    this.client.on(Events.MessageCreate, (message) => {
      this.handleMessage(message).catch((err) => this.logEventError("messageCreate", err));
    });

    this.client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      this.handleVoiceStateUpdate(oldState, newState).catch((err) =>
        this.logEventError("voiceStateUpdate", err),
      );
    });

    this.client.on(Events.GuildCreate, (guild) => {
      this.handleGuildCreate(guild).catch((err) => this.logEventError("guildCreate", err));
    });
  }

  /** One-time thank-you message when the bot is added to a server. */
  private async handleGuildCreate(guild: Guild): Promise<void> {
    if (!guild.available) return;
    // GuildCreate replays for every guild on startup — only greet fresh
    // additions (the bot joined within the last 10 minutes).
    if (Date.now() - (guild.joinedTimestamp ?? 0) > 10 * 60_000) return;

    try {
      const settings = await getGuildSettings(guild.id);
      if (settings.welcomed) return;

      const env = getEnv();
      const embed = baseEmbed()
        .setAuthor({ name: "🎉 Thanks for adding Slux!" })
        .setDescription(
          `Hey **${guild.name}** — I'm Slux, your new music bot! I'm online and ready to play.` +
            `\n\nTo get started, type **\`/play\`** or **\`${settings.prefix}play <song>\`** while in a voice channel.`,
        )
        .addFields(
          { name: "⌨️ Prefix", value: `\`${settings.prefix}\` — change it anytime with \`/prefix\``, inline: true },
          { name: "✨ Slash commands", value: "Type `/` and pick any command", inline: true },
          {
            name: "🖥️ Web dashboard",
            value: `[Open the dashboard](${env.APP_URL}/dashboard) — control everything from your browser`,
            inline: false,
          },
          {
            name: "📜 All commands",
            value: `[Browse the full command list](${env.APP_URL}/commands)`,
            inline: false,
          },
          {
            name: "💡 Tip",
            value: "Mention me (`@Slux`) anytime to see this server's prefix and popular commands!",
            inline: false,
          },
        )
        .setImage(
          "https://cdn.discordapp.com/attachments/922122006487515136/1547497081143562290/sluxwelcomemsg.png",
        )
        .setFooter({ text: "Made with ❤️ by SHM • YouTube: @Letzforge • Discord: shahrib" });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Open Dashboard")
          .setEmoji("🖥️")
          .setStyle(ButtonStyle.Link)
          .setURL(env.APP_URL),
        new ButtonBuilder()
          .setLabel("Commands")
          .setEmoji("📜")
          .setStyle(ButtonStyle.Link)
          .setURL(`${env.APP_URL}/commands`),
        new ButtonBuilder()
          .setLabel("YouTube")
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Link)
          .setURL("https://youtube.com/@Letzforge"),
        new ButtonBuilder()
          .setLabel("Support Server")
          .setEmoji("💬")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discord.gg/NC4YdDQj5u"),
      );

      // Prefer the system channel, else the first channel we can send in.
      let target: TextBasedChannel | null = guild.systemChannel;
      if (!target?.permissionsFor(guild.members.me ?? "")?.has(PermissionFlagsBits.SendMessages)) {
        target =
          guild.channels.cache.find(
            (ch): ch is TextChannel =>
              ch.isTextBased() &&
              ch
                .permissionsFor(guild.members.me ?? "")
                ?.has(PermissionFlagsBits.SendMessages | PermissionFlagsBits.ViewChannel) === true,
          ) ?? null;
      }
      await target
        ?.send({
          content: "Thanks for the invite!",
          embeds: [embed],
          components: [row],
        })
        .catch(() => null);

      await GuildModel.updateOne({ id: guild.id }, { $set: { welcomed: true } }).catch(() => null);
      invalidateGuildCache(guild.id);
      console.log(`[slux] Welcomed by guild ${guild.name} (${guild.id})`);
    } catch (err) {
      this.logEventError("guildCreate welcome", err);
    }
  }

  private logEventError(event: string, err: unknown): void {
    console.error(
      `[slux] ${event} handler error:`,
      err instanceof Error ? err.stack ?? err.message : err,
    );
  }

  // ── Slash registration ───────────────────────────────────────────

  localizedDescriptions(descriptionKey: string): Record<string, string> {
    const en = createTranslator("en")(descriptionKey);
    const out: Record<string, string> = {};
    for (const locale of LOCALES) {
      const text = createTranslator(locale.code)(descriptionKey);
      out[locale.discord] = text === descriptionKey ? en : text;
    }
    return out;
  }

  /** Discord API wants `description` as a plain string plus a separate
   *  `description_localizations` map — not an object in the description field. */
  private localizedText(
    descriptionKey: string,
  ): { description: string; localizations: Record<string, string> } {
    const localizations = this.localizedDescriptions(descriptionKey);
    for (const key of Object.keys(localizations)) {
      if (localizations[key].length > 100) localizations[key] = localizations[key].slice(0, 97) + "...";
    }
    return { description: localizations["en-US"] ?? descriptionKey, localizations };
  }

  private buildOptionData(option: CommandOptionSpec): ApplicationCommandOptionData {
    const { description, localizations } = this.localizedText(option.descriptionKey);
    const base = {
      name: option.name,
      description,
      description_localizations: localizations,
      required: option.required ?? false,
    };
    switch (option.type) {
      case "integer":
      case "number":
        return {
          ...base,
          type: option.type === "integer" ? ApplicationCommandOptionType.Integer : ApplicationCommandOptionType.Number,
          ...(option.min !== undefined ? { min_value: option.min } : {}),
          ...(option.max !== undefined ? { max_value: option.max } : {}),
        } as unknown as ApplicationCommandOptionData;
      case "boolean":
        return { ...base, type: ApplicationCommandOptionType.Boolean } as unknown as ApplicationCommandOptionData;
      case "role":
        return { ...base, type: ApplicationCommandOptionType.Role } as unknown as ApplicationCommandOptionData;
      case "channel":
        return { ...base, type: ApplicationCommandOptionType.Channel } as unknown as ApplicationCommandOptionData;
      case "user":
        return { ...base, type: ApplicationCommandOptionType.User } as unknown as ApplicationCommandOptionData;
      default:
        return {
          ...base,
          type: ApplicationCommandOptionType.String,
          ...(option.choices
            ? { choices: option.choices.map((c) => ({ name: c.nameKey, value: c.value })) }
            : {}),
        } as unknown as ApplicationCommandOptionData;
    }
  }

  private buildCommandJson(command: BotCommand): ApplicationCommandData {
    const { description, localizations } = this.localizedText(command.descriptionKey);
    const json = {
      name: command.name,
      description,
      description_localizations: localizations,
      dmPermission: false,
      type: ApplicationCommandType.ChatInput,
    } as Record<string, unknown>;

    if (command.subcommands && command.subcommands.length > 0) {
      json.options = command.subcommands.map((sub) => {
        const subText = this.localizedText(sub.descriptionKey);
        return {
          name: sub.name,
          description: subText.description,
          description_localizations: subText.localizations,
          type: ApplicationCommandOptionType.Subcommand,
          options: (sub.options ?? []).map((o) => this.buildOptionData(o)),
        };
      });
    } else if (command.options && command.options.length > 0) {
      json.options = command.options.map((o) => this.buildOptionData(o));
    }

    return json as unknown as ApplicationCommandData;
  }

  private async registerSlashCommands(): Promise<void> {
    const body = [...this.commands.values()].map((c) => this.buildCommandJson(c));
    try {
      await this.client.application?.commands.set(body);
      console.log(`[slux] Registered ${body.length} slash commands`);
    } catch (err) {
      console.error("[slux] Failed to register slash commands:", err);
    }
  }

  // ── Interaction handling ─────────────────────────────────────────

  private async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await this.handleSelectMenu(interaction);
      }
    } catch (err) {
      console.error("[slux] Interaction error:", err);
      const payload = {
        embeds: [errorEmbed(createTranslator("en"), "Something went wrong.")],
        flags: MessageFlags.Ephemeral,
      };
      const repliable = interaction as RepliableInteraction;
      if (repliable.isRepliable()) {
        if (repliable.deferred || repliable.replied) {
          await repliable.followUp(payload as never).catch(() => {});
        } else {
          await repliable.reply(payload as never).catch(() => {});
        }
      }
    }
  }

  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    // Arm the ACK safety net FIRST — before any awaited step below can stall
    // past Discord's 3s window. Whatever happens later, the interaction is
    // always acknowledged and ctx.reply() edits the deferral.
    const autoDefer = setTimeout(() => {
      if (!interaction.deferred && !interaction.replied) {
        void interaction.deferReply().catch(() => {});
      }
    }, 2400);
    autoDefer.unref?.();

    try {
      await this.runSlashCommand(interaction, command);
    } finally {
      clearTimeout(autoDefer);
    }
  }

  private async runSlashCommand(
    interaction: ChatInputCommandInteraction,
    command: BotCommand,
  ): Promise<void> {
    const guild = interaction.guild;
    const settings = guild ? await getGuildSettings(guild.id) : null;
    const locale = normalizeLocale(settings?.language ?? "en");
    const t = createTranslator(locale);

    if (await isBlacklisted("user", interaction.user.id)) {
      await interaction.reply({ content: t("common.blacklisted"), flags: MessageFlags.Ephemeral });
      return;
    }

    if (guild && settings && !botChannelAllowed(guild, settings, interaction.channelId)) {
      // ACK instead of silently dropping: an unacknowledged interaction makes
      // Discord show "application did not respond".
      await interaction
        .reply({ embeds: [errorEmbed(t, t("common.channelNotAllowed"))], flags: MessageFlags.Ephemeral })
        .catch(() => {});
      return;
    }

    if (!this.checkCooldown(interaction.user.id, command.name)) {
      // Same here — always ACK so the user sees why nothing happened.
      await interaction
        .reply({ embeds: [errorEmbed(t, t("common.cooldown"))], flags: MessageFlags.Ephemeral })
        .catch(() => {});
      return;
    }

    const options: Record<string, string | number | boolean | undefined> = {};
    let subcommand: string | undefined;

    if (command.subcommands) {
      subcommand = interaction.options.getSubcommand(false) ?? undefined;
      const sub = command.subcommands.find((s) => s.name === subcommand);
      for (const opt of sub?.options ?? []) {
        const value = interaction.options.get(opt.name, false)?.value;
        if (value !== null && value !== undefined) options[opt.name] = value;
      }
    } else if (command.options) {
      for (const opt of command.options) {
        const value = interaction.options.get(opt.name, false)?.value;
        if (value !== null && value !== undefined) options[opt.name] = value;
      }
    }

    const ctx = await this.createContext({
      interaction,
      locale,
      t,
      options,
      subcommand,
      prefix: settings?.prefix ?? "!",
      args: [],
    });

    const failure = await this.checkPermissions(ctx, command, settings);
    if (failure) {
      if (command.name === "play" || command.name === "search") {
        console.warn(
          `[slux] /${command.name} permission rejection for ${interaction.user.tag}: ${failure}`,
        );
      }
      await ctx.reply({ embeds: [errorEmbed(t, failure)], flags: MessageFlags.Ephemeral });
      return;
    }

    // Reply watchdog: whatever stalls inside the command, the user can never
    // be left on "thinking" forever — after 30s a visible error lands and the
    // console pinpoints which command stalled.
    let ctxReplied = false;
    const originalReply = ctx.reply;
    ctx.reply = async (replyOptions) => {
      ctxReplied = true;
      return originalReply(replyOptions);
    };
    const startedAt = Date.now();
    const watchdog = setTimeout(() => {
      if (ctxReplied || interaction.replied) return;
      console.error(
        `[slux] /${command.name} stalled for ${Date.now() - startedAt}ms without a reply — forcing an error reply`,
      );
      void interaction.followUp({ embeds: [errorEmbed(t, t("common.error"))] }).catch(() => {});
    }, 30_000);
    watchdog.unref?.();

    try {
      await command.execute(ctx);
    } catch (err) {
      console.error(`[slux] Command "${command.name}" failed:`, err);
      await ctx.reply({ embeds: [errorEmbed(t, t("common.error"))] }).catch(() => {});
    } finally {
      clearTimeout(watchdog);
    }
  }

  // ── Prefix message handling ──────────────────────────────────────

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild || !this.ready) return;

    const settings = await getGuildSettings(message.guild.id);
    const prefix = settings.prefix;
    const mention = `<@${this.client.user?.id}>`;

    // Mention-only message (e.g. "@Slux"): reply with the guild prefix and
    // quick-start help. This is the discovery path, so it ignores channel
    // restrictions and cooldowns.
    const mentionOnly = new RegExp(`^<@!?${this.client.user?.id}>\\s*$`);
    if (mentionOnly.test(message.content.trim())) {
      const t = createTranslator(normalizeLocale(settings.language));
      await message.reply(buildMentionHelp(t, prefix)).catch(() => {});
      return;
    }

    let usedPrefix = "";
    if (message.content.startsWith(prefix)) {
      usedPrefix = prefix;
    } else if (message.content.startsWith(mention)) {
      usedPrefix = mention;
    } else {
      return;
    }

    const body = message.content.slice(usedPrefix.length).trim();
    if (!body) return;
    const tokens = tokenize(body);
    const name = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    const command = this.commands.get(name) ?? this.commands.find((c) => c.aliases.includes(name));
    if (!command) return;

    const locale = normalizeLocale(settings.language);
    const t = createTranslator(locale);

    if (await isBlacklisted("user", message.author.id)) {
      await message.reply({ content: t("common.blacklisted") });
      return;
    }

    if (!botChannelAllowed(message.guild, settings, message.channelId)) return;

    if (!this.checkCooldown(message.author.id, command.name)) return;

    let options: Record<string, string | number | boolean | undefined> = {};
    let subcommand: string | undefined;
    let remaining = [...args];

    if (command.subcommands) {
      subcommand = remaining[0]?.toLowerCase();
      const sub = command.subcommands.find((s) => s.name === subcommand);
      if (!sub) {
        await message.reply({
          embeds: [
            errorEmbed(
              t,
              `playlist → ${command.subcommands.map((s) => `\`${s.name}\``).join(" ")}`,
            ),
          ],
        });
        return;
      }
      remaining = remaining.slice(1);
      ({ options, remaining } = this.parseOptions(sub.options ?? [], remaining));
    } else if (command.options) {
      ({ options, remaining } = this.parseOptions(command.options, remaining));
    }

    const ctx = await this.createContext({
      message,
      locale,
      t,
      options,
      subcommand,
      prefix: usedPrefix === mention ? `${mention} ` : usedPrefix,
      args: remaining,
    });

    const failure = await this.checkPermissions(ctx, command, settings);
    if (failure) {
      await ctx.reply({ embeds: [errorEmbed(t, failure)] });
      return;
    }

    try {
      await command.execute(ctx);
    } catch (err) {
      console.error(`[slux] Command "${command.name}" failed:`, err);
      await ctx.reply({ embeds: [errorEmbed(t, t("common.error"))] }).catch(() => {});
    }
  }

  private parseOptions(
    specs: CommandOptionSpec[],
    args: string[],
  ): { options: Record<string, string | number | boolean | undefined>; remaining: string[] } {
    const options: Record<string, string | number | boolean | undefined> = {};
    const remaining = [...args];
    for (const spec of specs) {
      if (spec.rest && spec.type === "string") {
        if (remaining.length > 0) {
          options[spec.name] = remaining.join(" ");
          remaining.length = 0;
        }
        continue;
      }
      const token = remaining.shift();
      if (token === undefined) continue;
      if (spec.type === "integer" || spec.type === "number") {
        const num = spec.type === "integer" ? parseInt(token, 10) : parseFloat(token);
        if (Number.isFinite(num)) {
          if (spec.min !== undefined && num < spec.min) continue;
          if (spec.max !== undefined && num > spec.max) continue;
          options[spec.name] = num;
        }
      } else if (spec.type === "boolean") {
        options[spec.name] = token === "true" || token === "yes" || token === "on";
      } else {
        options[spec.name] = token;
      }
    }
    return { options, remaining };
  }

  private async createContext(input: {
    interaction?: ChatInputCommandInteraction;
    message?: Message;
    locale: Locale;
    t: Translator;
    options: Record<string, string | number | boolean | undefined>;
    subcommand?: string;
    prefix: string;
    args: string[];
  }): Promise<CommandContext> {
    const { interaction, message, locale, t, options, subcommand, prefix, args } = input;
    const author = interaction?.user ?? message!.author;
    const guild = interaction?.guild ?? message!.guild ?? null;
    const channel = (interaction?.channel ?? message!.channel) ?? null;
    const rawMember = interaction?.member ?? message?.member ?? null;
    let member =
      rawMember && "permissions" in rawMember && typeof (rawMember as { permissions?: unknown }).permissions !== "undefined"
        ? (rawMember as NonNullable<CommandContext["member"]>)
        : null;
    // Slash interactions can arrive with an API member or an uncached voice
    // state — resolve a full GuildMember so voice checks and player creation
    // behave exactly like the dashboard path (which always fetches).
    if (interaction?.guild && (!member || !member.voice?.channelId)) {
      const fetched = await interaction.guild.members
        .fetch(interaction.user.id)
        .catch(() => null);
      if (fetched) member = fetched;
    }
    let lastReply: Message | null = null;

    return {
      client: this.client,
      guild,
      channel,
      author,
      member,
      locale,
      t,
      options,
      subcommand,
      prefix,
      args,
      interaction,
      message,
      pagination: this.pagination,
      searchSessions: this.searchSessions,
      reply: async (replyOptions) => {
        if (interaction) {
          // Deferred but not yet replied (explicit defer or the auto-defer
          // net): edit the deferral into the real reply instead of dangling
          // a "thinking…" message forever next to a followUp.
          if (interaction.deferred && !interaction.replied) {
            const payload = { ...(replyOptions as object) } as Record<string, unknown>;
            // Ephemeral flags are invalid on edits (Discord 400s the request)
            // — strip them so error replies after a defer always land.
            delete payload.flags;
            return (await interaction
              .editReply(payload)
              .catch((err: unknown) => {
                console.error("[slux] editReply failed:", err);
                return null;
              })) as unknown as Message | null;
          }
          if (interaction.deferred || interaction.replied) {
            return (await interaction.followUp(replyOptions as never).catch((err: unknown) => {
              console.error("[slux] followUp failed:", err);
              return null;
            })) as Message | null;
          }
          return (await interaction
            .reply({ ...(replyOptions as object), fetchReply: true } as never)
            .catch(async (err: unknown) => {
              // Race with the auto-defer net: the deferral ACKed first.
              // Land the content by editing the deferred reply instead.
              if (interaction.deferred && !interaction.replied) {
                const payload = { ...(replyOptions as object) } as Record<string, unknown>;
                delete payload.flags;
                return interaction.editReply(payload).catch(() => null);
              }
              console.error("[slux] interaction reply failed:", err);
              return null;
            })) as unknown as Message | null;
        }
        return message!.reply(replyOptions as never).catch(() => null);
      },
      editReply: async (replyOptions) => {
        if (interaction) {
          return (await interaction.editReply(replyOptions as never).catch(() => null)) as unknown as Message | null;
        }
        // Prefix flow: edit the last bot reply if there is one, else send one.
        if (lastReply) {
          return (await lastReply.edit(replyOptions as never).catch(() => null)) as Message | null;
        }
        lastReply = await message!.reply(replyOptions as never).catch(() => null);
        return lastReply;
      },
      defer: async (ephemeral = false) => {
        if (interaction && !interaction.deferred && !interaction.replied) {
          await interaction
            .deferReply({ flags: ephemeral ? MessageFlags.Ephemeral : undefined })
            .catch(() => {});
        }
      },
    };
  }

  private checkCooldown(userId: string, commandName: string): boolean {
    const key = `${userId}:${commandName}`;
    const now = Date.now();
    const last = this.cooldowns.get(key) ?? 0;
    if (now - last < COOLDOWN_MS) return false;
    this.cooldowns.set(key, now);
    return true;
  }

  private async checkPermissions(
    ctx: CommandContext,
    command: BotCommand,
    settings: Awaited<ReturnType<typeof getGuildSettings>> | null,
  ): Promise<string | null> {
    const perms = command.permissions;
    if (!perms) return null;
    const t = ctx.t;

    if (perms.manageGuild && !manageGuild(ctx.member)) {
      return t("common.manageGuildRequired");
    }

    if ((perms.voice || perms.sameVoice) && !ctx.member?.voice.channel) {
      return t("common.noVoiceChannel");
    }

    const player = ctx.guild ? this.music.getPlayer(ctx.guild.id) : undefined;

    if (perms.player && !player) return t("common.noPlayer");

    if (perms.sameVoice && player) {
      const botVoice = player.voiceChannel;
      if (botVoice && ctx.member?.voice.channelId && ctx.member.voice.channelId !== botVoice.id) {
        return t("common.notInSameVoice");
      }
    }

    if (perms.dj && settings && !isDJ(ctx.member, settings, player)) {
      return t("common.djRequired");
    }

    if (player && settings && !canControl(ctx.member, settings, player)) {
      return t("music.djmodeActive");
    }

    return null;
  }

  // ── Buttons ──────────────────────────────────────────────────────

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [ns, kind, ...rest] = interaction.customId.split(":");
    if (ns !== "slux") return;

    const guild = interaction.guild;
    if (!guild) return;
    const settings = await getGuildSettings(guild.id);
    const locale = normalizeLocale(settings.language);
    const t = createTranslator(locale);

    // Player-less interactions (generic pagination)
    if (kind === "pg") {
      await this.pagination.handle(interaction, rest[0] ?? "", rest[1] ?? "", t);
      return;
    }

    const player = this.music.getPlayer(guild.id);

    if (!player) {
      await interaction
        .reply({ embeds: [errorEmbed(t, t("common.noPlayer"))], flags: MessageFlags.Ephemeral })
        .catch(() => {});
      return;
    }

    switch (kind) {
      case "ctrl": {
        await handleControllerButton(interaction, this, player, t, settings);
        return;
      }
      case "q": {
        const page = Math.max(1, parseInt(rest[0] ?? "1", 10) || 1);
        const { embed, components } = await buildQueueMessage(
          player,
          guild.name,
          page,
          t,
          guild.iconURL() ?? undefined,
        );
        await interaction.update({ embeds: [embed], components }).catch(() => {});
        return;
      }
      case "sel": {
        await handleSearchSelect(interaction, this, player, t, settings, rest);
        return;
      }
      case "loop": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction
            .reply({ embeds: [errorEmbed(t, t("music.djmodeActive"))], flags: MessageFlags.Ephemeral })
            .catch(() => {});
          return;
        }
        await handleLoopButton(interaction, player, t, rest[0] ?? "");
        return;
      }
      case "vol": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction
            .reply({ embeds: [errorEmbed(t, t("music.djmodeActive"))], flags: MessageFlags.Ephemeral })
            .catch(() => {});
          return;
        }
        await handleVolumeButton(interaction, player, t, rest[0] ?? "0");
        return;
      }
      case "tgl": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction
            .reply({ embeds: [errorEmbed(t, t("music.djmodeActive"))], flags: MessageFlags.Ephemeral })
            .catch(() => {});
          return;
        }
        await handleToggleButton(interaction, player, t, rest[0] ?? "");
        return;
      }
      case "fxopen": {
        await interaction.update(buildFiltersPanel(player, t)).catch(() => {});
        return;
      }
      case "fxreset": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction
            .reply({ embeds: [errorEmbed(t, t("music.djmodeActive"))], flags: MessageFlags.Ephemeral })
            .catch(() => {});
          return;
        }
        await handleFilterReset(interaction, player, t);
        return;
      }
    }
  }

  // ── Select menus ────────────────────────────────────────────────

  private async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    const [ns, kind, ...rest] = interaction.customId.split(":");
    if (ns !== "slux") return;

    const guild = interaction.guild;
    if (!guild) return;
    const settings = await getGuildSettings(guild.id);
    const locale = normalizeLocale(settings.language);
    const t = createTranslator(locale);
    const value = interaction.values[0];

    if (kind === "help") {
      const prefix = settings.prefix ?? "!";
      await handleHelpSelect(interaction, this.pagination, t, value, prefix);
      return;
    }

    const player = this.music.getPlayer(guild.id);
    if (!player) {
      await interaction
        .reply({ embeds: [errorEmbed(t, t("common.noPlayer"))], flags: MessageFlags.Ephemeral })
        .catch(() => {});
      return;
    }

    switch (kind) {
      case "sel": {
        await handleSearchSelect(interaction, this, player, t, settings, rest, value);
        return;
      }
      case "fx": {
        const member = guild.members.cache.get(interaction.user.id) ?? null;
        if (!canControl(member, settings, player)) {
          await interaction
            .reply({ embeds: [errorEmbed(t, t("music.djmodeActive"))], flags: MessageFlags.Ephemeral })
            .catch(() => {});
          return;
        }
        await handleFilterSelect(interaction, player, t, value ?? "");
        return;
      }
      case "qsel": {
        const page = Math.max(1, parseInt(value ?? "1", 10) || 1);
        const { embed, components } = await buildQueueMessage(
          player,
          guild.name,
          page,
          t,
          guild.iconURL() ?? undefined,
        );
        await interaction.update({ embeds: [embed], components }).catch(() => {});
        return;
      }
    }
  }

  // ── Voice state handling ─────────────────────────────────────────

  private async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guildId = oldState.guild.id;
    const player = this.music.getPlayer(guildId);
    if (!player) return;

    if (oldState.id === this.client.user?.id) {
      if (!newState.channelId) {
        await this.music.destroyPlayer(guildId, "disconnected");
        return;
      }
      return;
    }

    if (!newState.channelId || newState.channelId !== player.voiceChannel?.id) {
      const channel = player.voiceChannel;
      if (!channel) return;
      const humans = channel.members.filter((m) => !m.user.bot);
      if (humans.size === 0 && !player.stayInChannel) {
        if (player.current) await player.pause();
        setTimeout(() => {
          const p = this.music.getPlayer(guildId);
          if (!p) return;
          const ch = p.voiceChannel;
          if (ch && ch.members.filter((m) => !m.user.bot).size === 0 && !p.stayInChannel) {
            void p.leaveDueTo("alone");
          }
        }, 60_000).unref?.();
      }
    }
  }

  invalidateGuild(guildId: string): void {
    invalidateGuildCache(guildId);
    void this.music.getPlayer(guildId)?.refreshLocale();
  }

  get uptimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}

export { BRAND_COLOR };
