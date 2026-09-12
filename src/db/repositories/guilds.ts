import mongoose from "mongoose";
import { GuildModel, type GuildData } from "../models/Guild";

const cache = new Map<string, GuildData>();
const CACHE_TTL = 30_000;
const expiry = new Map<string, number>();

export const DEFAULT_GUILD_SETTINGS = {
  prefix: "!",
  language: "en",
  djRoles: [] as string[],
  botChannels: [] as string[],
  defaultVolume: 100,
  defaultAutoplay: false,
  default247: false,
  idleTimeout: 5,
  welcomed: false,
};

function defaultsFor(guildId: string): GuildData {
  return { ...DEFAULT_GUILD_SETTINGS, id: guildId } as GuildData;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("database timeout")), ms);
      timer.unref?.();
    }),
  ]);
}

function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function getGuildSettings(guildId: string): Promise<GuildData> {
  const now = Date.now();
  const cachedAt = expiry.get(guildId) ?? 0;
  if (cache.has(guildId) && now - cachedAt < CACHE_TTL) {
    return cache.get(guildId)!;
  }

  // Never let commands hang on a stalled/unreachable database: mongoose
  // buffers queries forever when disconnected, which would freeze every
  // slash interaction on "thinking". Fall back to cached/default settings.
  if (!dbReady()) {
    console.warn("[slux] Database not connected — using default guild settings");
    return cache.get(guildId) ?? defaultsFor(guildId);
  }

  try {
    let doc = await withTimeout(GuildModel.findOne({ id: guildId }).lean<GuildData>(), 3_000);
    if (!doc) {
      const created = await withTimeout(GuildModel.create({ id: guildId }), 3_000);
      doc = created.toObject() as GuildData;
    }
    cache.set(guildId, doc);
    expiry.set(guildId, now);
    return doc;
  } catch (err) {
    console.warn(
      `[slux] Guild settings unavailable (${err instanceof Error ? err.message : String(err)}) — using defaults`,
    );
    return cache.get(guildId) ?? defaultsFor(guildId);
  }
}

export async function updateGuildSettings(
  guildId: string,
  patch: Partial<Pick<GuildData, "prefix" | "language" | "djRoles" | "botChannels" | "defaultVolume" | "defaultAutoplay" | "default247" | "idleTimeout">>,
): Promise<GuildData> {
  if (!dbReady()) {
    throw new Error("database unavailable — try again in a moment");
  }
  const doc = await GuildModel.findOneAndUpdate({ id: guildId }, { $set: patch }, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).lean<GuildData>();
  cache.set(guildId, doc);
  expiry.set(guildId, Date.now());
  return doc;
}

export function invalidateGuildCache(guildId: string): void {
  cache.delete(guildId);
  expiry.delete(guildId);
}
