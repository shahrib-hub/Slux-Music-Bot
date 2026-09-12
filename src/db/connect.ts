import mongoose from "mongoose";
import { getEnv } from "@/lib/env";

declare global {
  var __slux_mongo: mongoose.Mongoose | undefined;
}

export async function connectDatabase(): Promise<mongoose.Mongoose> {
  if (globalThis.__slux_mongo) return globalThis.__slux_mongo;
  const env = getEnv();
  mongoose.set("strictQuery", true);
  const conn = await mongoose.connect(env.MONGODB_URI, {
    dbName: "slux",
    // Fail fast instead of buffering queries forever while disconnected —
    // hot paths (guild settings, blacklist) fall back to defaults.
    bufferCommands: false,
  });
  globalThis.__slux_mongo = conn;
  return conn;
}

export async function disconnectDatabase(): Promise<void> {
  if (globalThis.__slux_mongo) {
    await globalThis.__slux_mongo.disconnect();
    globalThis.__slux_mongo = undefined;
  }
}

export { mongoose };
