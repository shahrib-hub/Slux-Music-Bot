import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { GuildPlayer } from "@/bot/music/GuildPlayer";
import type { ResolvedTrack } from "@/bot/music/types";

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

function makeGuildPlayer(events?: {
  onSnapshot?: () => void;
  onTrackStart?: () => void;
  onDestroy?: () => void;
}): GuildPlayer {
  const shoukakuPlayer = new EventEmitter() as never as import("shoukaku").Player;
  Object.assign(shoukakuPlayer, {
    paused: false,
    position: 0,
    volume: 100,
    filters: {},
    guildId: "guild1",
    playTrack: vi.fn().mockResolvedValue(undefined),
    stopTrack: vi.fn().mockResolvedValue(undefined),
    setPaused: vi.fn(async (value: boolean) => {
      shoukakuPlayer.paused = value;
    }),
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
    ...events,
  });
}

describe("GuildPlayer queue logic", () => {
  let player: GuildPlayer;

  beforeEach(() => {
    player = makeGuildPlayer();
  });

  it("enqueue appends to the end", () => {
    player.enqueue(makeTrack("a"));
    player.enqueue(makeTrack("b"));
    expect(player.queue.map((t) => t.title)).toEqual(["a", "b"]);
  });

  it("enqueue with position inserts at index", () => {
    player.enqueue(makeTrack("a"));
    player.enqueue(makeTrack("b"));
    player.enqueue(makeTrack("c"), 0);
    expect(player.queue.map((t) => t.title)).toEqual(["c", "a", "b"]);
  });

  it("removeAt uses 1-based indexes and returns the removed track", () => {
    player.enqueue(makeTrack("a"));
    player.enqueue(makeTrack("b"));
    player.enqueue(makeTrack("c"));
    const removed = player.removeAt(2);
    expect(removed?.title).toBe("b");
    expect(player.queue.map((t) => t.title)).toEqual(["a", "c"]);
    expect(player.removeAt(99)).toBeNull();
    expect(player.removeAt(0)).toBeNull();
  });

  it("moveTrack moves within bounds", () => {
    for (const name of ["a", "b", "c", "d"]) player.enqueue(makeTrack(name));
    const moved = player.moveTrack(1, 4);
    expect(moved?.title).toBe("a");
    expect(player.queue.map((t) => t.title)).toEqual(["b", "c", "d", "a"]);
    expect(player.moveTrack(0, 2)).toBeNull();
    expect(player.moveTrack(1, 99)).toBeNull();
  });

  it("shuffleQueue preserves all elements", () => {
    const names = Array.from({ length: 40 }, (_, i) => `t${i}`);
    for (const name of names) player.enqueue(makeTrack(name));
    player.shuffleQueue();
    const current = player.queue.map((t) => t.title);
    expect(current).toHaveLength(40);
    expect([...current].sort()).toEqual([...names].sort());
  });

  it("clearQueue returns the cleared count", () => {
    player.enqueue(makeTrack("a"));
    player.enqueue(makeTrack("b"));
    expect(player.clearQueue()).toBe(2);
    expect(player.queue).toHaveLength(0);
  });

  it("skipTo drops everything before the target and jumps to it", async () => {
    for (const name of ["a", "b", "c", "d"]) player.enqueue(makeTrack(name));
    const target = player.skipTo(3);
    expect(target?.title).toBe("c");
    // skip() is async — give it a tick to run playNext
    await new Promise((r) => setTimeout(r, 10));
    expect(player.queue.map((t) => t.title)).toEqual(["d"]);
  });

  it("skipTo rejects out-of-range indexes", () => {
    player.enqueue(makeTrack("a"));
    expect(player.skipTo(0)).toBeNull();
    expect(player.skipTo(2)).toBeNull();
    expect(player.skipTo(1)?.title).toBe("a");
  });

  it("removeDuplicates keeps the first occurrence of each track", () => {
    const a = makeTrack("a");
    const b = makeTrack("b");
    player.enqueue(a);
    player.enqueue(makeTrack("x"));
    player.enqueue(b);
    player.enqueue(a); // duplicate of first
    const removed = player.removeDuplicates();
    expect(removed).toBe(1);
    expect(player.queue.map((t) => t.title)).toEqual(["a", "x", "b"]);
  });

  it("removeDuplicates returns 0 on a clean queue", () => {
    player.enqueue(makeTrack("a"));
    player.enqueue(makeTrack("b"));
    expect(player.removeDuplicates()).toBe(0);
    expect(player.queue).toHaveLength(2);
  });

  it("setSleepTimer sets and cancels the deadline", () => {
    vi.useFakeTimers();
    try {
      expect(player.setSleepTimer(30)).toBeGreaterThan(Date.now());
      expect(player.sleepTimerUntil).not.toBeNull();
      expect(player.setSleepTimer(0)).toBeNull();
      expect(player.sleepTimerUntil).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("setSleepTimer pauses the player when it fires", async () => {
    vi.useFakeTimers();
    try {
      player.setSleepTimer(10);
      await vi.advanceTimersByTimeAsync(10 * 60_000 + 50);
      expect(player.paused).toBe(true);
      expect(player.sleepTimerUntil).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cycleRepeat walks off → track → queue → off", () => {
    expect(player.cycleRepeat()).toBe("track");
    expect(player.repeat).toBe("track");
    expect(player.cycleRepeat()).toBe("queue");
    expect(player.cycleRepeat()).toBe("off");
  });

  it("setRepeat updates state", async () => {
    await player.setRepeat("queue");
    expect(player.repeat).toBe("queue");
  });

  it("filters toggle and reset", async () => {
    await player.applyFilter("nightcore");
    expect(player.hasFilter("nightcore")).toBe(true);
    const removed = await player.removeFilter("nightcore");
    expect(removed).toBe(true);
    expect(player.hasFilter("nightcore")).toBe(false);
    await player.applyFilter("bassboost", 0.5);
    await player.applyFilter("8d");
    await player.resetFilters();
    expect(player.hasFilter("bassboost")).toBe(false);
    expect(player.hasFilter("8d")).toBe(false);
  });

  it("snapshot reflects queue and repeat state", async () => {
    player.enqueue(makeTrack("a"));
    await player.setRepeat("track");
    const snapshot = player.snapshot();
    expect(snapshot.queue).toHaveLength(1);
    expect(snapshot.repeat).toBe("track");
    expect(snapshot.guildId).toBe("guild1");
    expect(snapshot.connected).toBe(false);
  });
});

describe("dashboard heartbeat (3s snapshot push)", () => {
  it("emits a snapshot every 3s while a track is playing", async () => {
    vi.useFakeTimers();
    try {
      const onSnapshot = vi.fn();
      const player = makeGuildPlayer({ onSnapshot });
      player.current = makeTrack("a");

      // The emit() that set up the heartbeat fires immediately once.
      player.emit();
      const before = onSnapshot.mock.calls.length;
      expect(before).toBeGreaterThanOrEqual(1);

      await vi.advanceTimersByTimeAsync(3_100);
      expect(onSnapshot.mock.calls.length).toBe(before + 1);
      await vi.advanceTimersByTimeAsync(6_000);
      expect(onSnapshot.mock.calls.length).toBeGreaterThanOrEqual(before + 3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays silent while paused and stops after destroy", async () => {
    vi.useFakeTimers();
    try {
      const onSnapshot = vi.fn();
      const player = makeGuildPlayer({ onSnapshot });
      player.current = makeTrack("a");

      await player.pause();
      player.emit();
      const paused = onSnapshot.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(onSnapshot.mock.calls.length).toBe(paused); // no ticks while paused

      await player.resume();
      await vi.advanceTimersByTimeAsync(3_100);
      expect(onSnapshot.mock.calls.length).toBeGreaterThan(paused); // resumes ticking

      await player.destroy("stopped");
      const atDestroy = onSnapshot.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(onSnapshot.mock.calls.length).toBe(atDestroy); // heartbeat cleaned up
    } finally {
      vi.useRealTimers();
    }
  });
});
