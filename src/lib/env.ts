import { z } from "zod";

/** Parse an env-var boolean. Accepts true/1/yes/on and false/0/no/off;
 *  anything else (including unset/empty) falls back to the default. */
function boolFlag(defaultValue: boolean) {
  return z.preprocess(
    (raw) => {
      if (raw === undefined || raw === null || raw === "") return defaultValue;
      if (typeof raw === "boolean") return raw;
      const s = String(raw).trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(s)) return true;
      if (["0", "false", "no", "off"].includes(s)) return false;
      return defaultValue;
    },
    z.boolean(),
  );
}

const optionalHost = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Bind address for the HTTP server (hosting platforms need 0.0.0.0). */
  HOST: z.string().default("0.0.0.0"),
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_CLIENT_SECRET: z.string().min(1, "DISCORD_CLIENT_SECRET is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/slux"),

  // ── Lavalink: main node (3rd-party) ──────────────────────────────
  LAVALINK_HOST: z.string().default("localhost"),
  LAVALINK_PORT: z.coerce.number().int().positive().default(2333),
  LAVALINK_PASS: z.string().default("youshallnotpass"),
  // TLS (wss/https) — most 3rd-party nodes need this
  LAVALINK_SECURE: boolFlag(false),
  LAVALINK_NAME: z.string().min(1).default("main"),

  // ── Lavalink: optional backup node ───────────────────────────────
  // Set LAVALINK_BACKUP_HOST to enable automatic failover: Shoukaku picks
  // the healthiest connected node (by penalties), so when the main node is
  // offline or busy the backup takes over automatically.
  LAVALINK_BACKUP_HOST: optionalHost,
  LAVALINK_BACKUP_PORT: z.coerce.number().int().positive().optional(),
  LAVALINK_BACKUP_PASS: z.string().optional(),
  LAVALINK_BACKUP_SECURE: boolFlag(false),
  LAVALINK_BACKUP_NAME: z.string().min(1).default("backup"),

  SPOTIFY_CLIENT_ID: z.string().optional().default(""),
  SPOTIFY_CLIENT_SECRET: z.string().optional().default(""),
});

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[slux] Invalid environment configuration:\n${issues}\n` +
        "Copy .env.example to .env and fill in the required values.",
    );
  }
  return parsed.data;
}

declare global {
  var __slux_env: Env | undefined;
}

export function getEnv(): Env {
  if (!globalThis.__slux_env) globalThis.__slux_env = loadEnv();
  return globalThis.__slux_env;
}
