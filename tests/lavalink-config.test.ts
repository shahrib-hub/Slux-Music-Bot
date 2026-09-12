import { describe, it, expect, beforeEach } from "vitest";
import { getEnv } from "@/lib/env";
import { lavalinkNodeOptions } from "@/lib/lavalink";

const REQUIRED = {
  DISCORD_TOKEN: "token",
  DISCORD_CLIENT_ID: "id",
  DISCORD_CLIENT_SECRET: "secret",
  SESSION_SECRET: "s".repeat(32),
};

const BASE = {
  LAVALINK_HOST: "main.example.com",
  LAVALINK_PORT: "443",
  LAVALINK_PASS: "mainpass",
  LAVALINK_SECURE: "true",
};

function setEnv(vars: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("LAVALINK_")) delete process.env[key];
  }
  Object.assign(process.env, REQUIRED, BASE, vars);
  (globalThis as { __slux_env?: unknown }).__slux_env = undefined;
}

beforeEach(() => setEnv({}));

describe("lavalink env config", () => {
  it("binds to all interfaces by default (hosting compatible)", () => {
    expect(getEnv().HOST).toBe("0.0.0.0");
  });

  it("builds a single main node when no backup is configured", () => {
    expect(lavalinkNodeOptions()).toEqual([
      { name: "main", url: "main.example.com:443", auth: "mainpass", secure: true },
    ]);
  });

  it("adds the backup node when LAVALINK_BACKUP_HOST is set", () => {
    setEnv({
      LAVALINK_BACKUP_HOST: "backup.example.com",
      LAVALINK_BACKUP_PORT: "2333",
      LAVALINK_BACKUP_PASS: "backuppass",
    });
    expect(lavalinkNodeOptions()).toEqual([
      { name: "main", url: "main.example.com:443", auth: "mainpass", secure: true },
      { name: "backup", url: "backup.example.com:2333", auth: "backuppass", secure: false },
    ]);
  });

  it("defaults the backup port to 443 when secure and no port is given", () => {
    setEnv({
      LAVALINK_BACKUP_HOST: "backup.example.com",
      LAVALINK_BACKUP_PASS: "backuppass",
      LAVALINK_BACKUP_SECURE: "true",
    });
    expect(lavalinkNodeOptions()).toEqual([
      { name: "main", url: "main.example.com:443", auth: "mainpass", secure: true },
      { name: "backup", url: "backup.example.com:443", auth: "backuppass", secure: true },
    ]);
  });

  it("falls back to the main password for the backup node", () => {
    setEnv({
      LAVALINK_BACKUP_HOST: "backup.example.com",
      LAVALINK_BACKUP_PORT: "2333",
    });
    expect(lavalinkNodeOptions()[1]).toEqual({
      name: "backup",
      url: "backup.example.com:2333",
      auth: "mainpass",
      secure: false,
    });
  });

  it("ignores a whitespace-only backup host", () => {
    setEnv({ LAVALINK_BACKUP_HOST: "   " });
    expect(lavalinkNodeOptions()).toHaveLength(1);
  });

  it.each(["true", "1", "yes", "on"])("parses LAVALINK_SECURE=%s as true", (value) => {
    setEnv({ LAVALINK_SECURE: value });
    expect(getEnv().LAVALINK_SECURE).toBe(true);
  });

  it.each(["false", "0", "no", "off"])("parses LAVALINK_SECURE=%s as false", (value) => {
    setEnv({ LAVALINK_SECURE: value });
    expect(getEnv().LAVALINK_SECURE).toBe(false);
  });

  it("keeps a custom backup node name", () => {
    setEnv({
      LAVALINK_BACKUP_HOST: "backup.example.com",
      LAVALINK_BACKUP_NAME: "euro-failover",
    });
    expect(lavalinkNodeOptions()[1]?.name).toBe("euro-failover");
  });
});
