import type {
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildMember,
  Message,
  TextBasedChannel,
  User,
} from "discord.js";
import type { Locale, Translator } from "@/i18n";
import type { PaginationManager, SearchSession } from "@/bot/controller";

export type CommandCategory = "music" | "playlists" | "filters" | "settings" | "info";

export type OptionType = "string" | "integer" | "number" | "boolean" | "role" | "channel" | "user";

export interface CommandOptionSpec {
  name: string;
  descriptionKey: string;
  type: OptionType;
  required?: boolean;
  rest?: boolean;
  min?: number;
  max?: number;
  choices?: { nameKey: string; value: string }[];
}

export interface SubCommandSpec {
  name: string;
  descriptionKey: string;
  options?: CommandOptionSpec[];
}

export interface CommandPermissions {
  /** User must be in a voice channel */
  voice?: boolean;
  /** User must be in the same voice channel as the bot */
  sameVoice?: boolean;
  /** A player must exist for this guild */
  player?: boolean;
  /** Requires DJ role / ManageChannels / ManageGuild / sole listener */
  dj?: boolean;
  /** Requires ManageGuild */
  manageGuild?: boolean;
  /** Requires the user to be in the same voice channel OR have DJ perms (used by djmode) */
}

export interface CommandContext {
  client: Client;
  guild: Guild | null;
  channel: TextBasedChannel | null;
  author: User;
  member: GuildMember | null;
  locale: Locale;
  t: Translator;
  /** Resolved options (slash) or parsed args (prefix) keyed by option name */
  options: Record<string, string | number | boolean | undefined>;
  args: string[];
  prefix: string;
  subcommand?: string;
  interaction?: ChatInputCommandInteraction;
  message?: Message;
  /** Button-pagination sessions for paged views (lyrics, playlists, help) */
  pagination?: PaginationManager;
  /** Search-picker sessions keyed by message id */
  searchSessions?: Map<string, SearchSession>;
  reply: (options: ReplyPayload) => Promise<Message | null>;
  editReply: (options: ReplyPayload) => Promise<Message | null>;
  defer: (ephemeral?: boolean) => Promise<void>;
}

export interface ReplyPayload {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  flags?: number;
  fetchReply?: boolean;
}

export interface BotCommand {
  name: string;
  descriptionKey: string;
  category: CommandCategory;
  aliases: string[];
  permissions?: CommandPermissions;
  options?: CommandOptionSpec[];
  subcommands?: SubCommandSpec[];
  usageExample?: string;
  execute: (ctx: CommandContext) => Promise<unknown>;
}
