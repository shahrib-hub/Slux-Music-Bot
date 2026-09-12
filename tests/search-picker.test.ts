import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { presentSearchSelection, resolveAndPlay } from "@/bot/commands/helpers";
import { GuildPlayer } from "@/bot/music/GuildPlayer";
import {
  PaginationManager,
  handleSearchSelect,
  buildSearchSelectComponents,
  buildControllerComponents,
  buildPaginationRow,
} from "@/bot/controller";
import type { CommandContext } from "@/bot/commands/types";
import type { MusicManager } from "@/bot/music/MusicManager";
import type { ResolvedTrack } from "@/bot/music/types";
import type { BotService } from "@/bot/bot";
import { createTranslator } from "@/i18n";

function makeTrack(title: string, id = title): ResolvedTrack {
  return {
    encoded: `enc_${id}`,
    title,
    author: "Artist",
    length: 120_000,
    uri: `https://example.com/${id}`,
    artwork: "",
    sourceName: "youtube",
    identifier: id,
    isrc: "",
    isStream: false,
    isSeekable: true,
    requesterId: "user1",
    requesterTag: "user#1",
    requesterAvatar: "",
  };
}

function makeGuildPlayer(): GuildPlayer {
  const shoukakuPlayer = new EventEmitter() as never as import("shoukaku").Player;
  Object.assign(shoukakuPlayer, {
    paused: false,
    position: 0,
    volume: 100,
    filters: {},
    guildId: "guild1",
    playTrack: vi.fn().mockResolvedValue(undefined),
    stopTrack: vi.fn().mockResolvedValue(undefined),
    setPaused: vi.fn().mockResolvedValue(undefined),
    seekTo: vi.fn().mockResolvedValue(undefined),
    setGlobalVolume: vi.fn().mockResolvedValue(undefined),
    setFilters: vi.fn().mockResolvedValue(undefined),
    clearFilters: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    on: shoukakuPlayer.on.bind(shoukakuPlayer),
  });

  const client = {
    guilds: { cache: new Map() },
    shoukaku: { connections: new Map() },
  } as never as import("discord.js").Client;

  return new GuildPlayer("guild1", client, shoukakuPlayer as never, {
    onSnapshot: () => {},
    onTrackStart: () => {},
    onDestroy: () => {},
  });
}

/** A fake reply message with id + edit, as returned by CommandContext.reply. */
function makeReplyMessage(id: string) {
  return {
    id,
    createdTimestamp: Date.now(),
    edit: vi.fn().mockResolvedValue(undefined),
  } as never as import("discord.js").Message;
}

interface Harness {
  ctx: CommandContext;
  player: GuildPlayer;
  searchSessions: Map<string, import("@/bot/controller").SearchSession>;
  pagination: PaginationManager;
  replies: import("discord.js").Message[];
}

function makeHarness(music: Partial<MusicManager> = {}): Harness {
  const player = makeGuildPlayer();
  const searchSessions = new Map<string, import("@/bot/controller").SearchSession>();
  const pagination = new PaginationManager();
  const replies: import("discord.js").Message[] = [];
  let seq = 0;

  const musicMock = {
    getPlayer: vi.fn().mockReturnValue(player),
    createPlayer: vi.fn().mockResolvedValue(player),
    resolve: vi.fn().mockResolvedValue({ kind: "empty" }),
    ...music,
  } as unknown as MusicManager;

  const ctx = {
    client: {
      music: musicMock,
      shoukaku: { getIdealNode: () => ({ name: "main" }) },
    },
    guild: { id: "guild1", name: "Guild" },
    channel: { id: "chan1" },
    author: {
      id: "user1",
      tag: "user#1",
      displayAvatarURL: () => "https://example.com/a.png",
    },
    member: { voice: { channelId: "v1" } },
    locale: "en" as const,
    t: createTranslator("en"),
    options: {},
    args: [],
    prefix: "!",
    pagination,
    searchSessions,
    reply: vi.fn(async (_payload: { embeds?: unknown[]; components?: unknown[] }) => {
      const message = makeReplyMessage(`msg${++seq}`);
      replies.push(message);
      return message;
    }),
    editReply: vi.fn(async () => null),
    defer: vi.fn(async () => {}),
  } as unknown as CommandContext;

  return { ctx, player, searchSessions, pagination, replies };
}

describe("search picker flow (play/search commands)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    return () => vi.useRealTimers();
  });

  it("stores a picker session keyed by message id so buttons work", async () => {
    const { ctx, player, searchSessions, replies } = makeHarness();
    const tracks = [makeTrack("Song A"), makeTrack("Song B")];

    await presentSearchSelection(ctx, player, "query", tracks);

    expect(replies).toHaveLength(1);
    expect(searchSessions.size).toBe(1);
    const session = searchSessions.get(replies[0]!.id);
    expect(session).toBeDefined();
    expect(session!.tracks).toHaveLength(2);
    expect(session!.userId).toBe("user1");
  });

  it("expires the picker session after 30s and disables the message", async () => {
    const { ctx, player, searchSessions, replies } = makeHarness();
    await presentSearchSelection(ctx, player, "q", [makeTrack("Song A")]);

    vi.advanceTimersByTime(31_000);
    expect(searchSessions.size).toBe(0);
    expect(replies[0]!.edit).toHaveBeenCalled();
  });

  it("falls back to a plain list when no session store is available", async () => {
    const { ctx } = makeHarness();
    delete (ctx as Partial<CommandContext>).searchSessions;
    // Must not throw (this was the production bug: writing to a missing map).
    await expect(
      presentSearchSelection(ctx, makeGuildPlayer(), "q", [makeTrack("Song A")]),
    ).resolves.toBeUndefined();
  });

  it("picking via the dropdown enqueues the chosen track", async () => {
    const { ctx, player, searchSessions, replies } = makeHarness();
    const tracks = [makeTrack("Song A"), makeTrack("Song B")];
    await presentSearchSelection(ctx, player, "q", tracks);

    const messageId = replies[0]!.id;
    const interaction = {
      customId: `slux:sel:${"x"}`,
      user: { id: "user1" },
      guild: { id: "guild1", members: { cache: new Map() } },
      message: { id: messageId },
      values: ["1"],
      update: vi.fn().mockResolvedValue(undefined),
    } as never as import("discord.js").StringSelectMenuInteraction;

    const bot = {
      music: ctx.client.music,
      searchSessions,
      pagination: new PaginationManager(),
    } as unknown as BotService;

    await handleSearchSelect(
      interaction,
      bot,
      player,
      createTranslator("en"),
      { djRoles: [] } as never,
      [],
      "1",
    );

    expect(player.current?.title).toBe("Song B");
    expect(searchSessions.size).toBe(0);
  });

  it("resolveAndPlay with search results shows the picker without throwing", async () => {
    const tracks = [makeTrack("Song A"), makeTrack("Song B"), makeTrack("Song C")];
    const { ctx, searchSessions } = makeHarness({
      resolve: vi.fn().mockResolvedValue({ kind: "search", tracks }),
    } as unknown as Partial<MusicManager>);

    await expect(resolveAndPlay(ctx, "some song")).resolves.toBeUndefined();
    expect(searchSessions.size).toBe(1);
  });

  it("search picker rows never exceed 5 components (Discord limit)", () => {
    const t = createTranslator("en");
    for (const count of [1, 2, 3, 4, 5, 10]) {
      const tracks = Array.from({ length: count }, (_, i) => makeTrack(`Song ${i + 1}`));
      const rows = buildSearchSelectComponents(t, "sess", tracks);
      for (const row of rows) {
        expect(row.components.length).toBeLessThanOrEqual(5);
      }
      // With 5+ results the numbered row must be 4 buttons + cancel = 5
      if (count >= 5) {
        expect(rows[1].components.length).toBe(5);
      }
    }
  });

  it("controller and pagination rows never exceed 5 components", () => {
    const t = createTranslator("en");
    const player = makeGuildPlayer();
    for (const row of buildControllerComponents(player, t)) {
      expect(row.components.length).toBeLessThanOrEqual(5);
    }
    expect(buildPaginationRow("sess", 2, 10).components.length).toBeLessThanOrEqual(5);
  });

  it("rejects with the engine-not-ready error when no Lavalink node is connected", async () => {
    const tracks = [makeTrack("Song A")];
    const { ctx, searchSessions } = makeHarness({
      resolve: vi.fn().mockResolvedValue({ kind: "search", tracks }),
    } as unknown as Partial<MusicManager>);
    (ctx.client as unknown as { shoukaku: { getIdealNode: () => unknown } }).shoukaku.getIdealNode =
      () => undefined;

    await expect(resolveAndPlay(ctx, "some song")).resolves.toBeUndefined();
    expect(searchSessions.size).toBe(0);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const payload = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      embeds: { data: { description?: string } }[];
    };
    expect(payload.embeds[0].data.description).toContain("music engine");
  });
});
