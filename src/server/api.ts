import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { getEnv, type Env } from "@/lib/env";
import { getBot } from "@/lib/bot-singleton";
import { inviteUrl } from "@/lib/invite";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  discordOAuthUrl,
  oauthStateSecret,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/jwt";
import { getGuildSettings, updateGuildSettings } from "@/db/repositories/guilds";
import { PlaylistModel, MAX_PLAYLIST_TRACKS } from "@/db/models/Playlist";
import { LOCALES } from "@/i18n";
import { COMMAND_COUNT } from "@/lib/command-catalog";

/**
 * Backend HTTP API (raw Node http — no Next.js).
 *
 * Endpoints (all under /api):
 *   GET    /api/auth/login          → Discord OAuth redirect
 *   GET    /api/auth/callback       → OAuth callback, sets session cookie
 *   POST   /api/auth/logout
 *   GET    /api/auth/me
 *   GET    /api/stats               (public)
 *   GET    /api/guilds
 *   GET    /api/guilds/:id/settings   PATCH same
 *   GET    /api/player/:id
 *   GET    /api/lyrics/:id
 *   GET    /api/search?q=
 *   GET|POST /api/playlists
 *   GET|PATCH|DELETE /api/playlists/:id
 */

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
  query: URLSearchParams,
) => Promise<void>;

// ── Helpers ─────────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, data: unknown, headers?: Record<string, string>): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body);
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req: IncomingMessage, limit = 512 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie ?? "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/** Session cookie attributes. With the Vercel-rewrite proxy pattern all
 *  browser requests arrive same-origin (Vercel forwards them), so Lax
 *  cookies work everywhere: dev (localhost:3000 ↔ :3001 share the cookie
 *  jar — cookies ignore ports) and production (vercel.app domain). */
function sessionCookie(env: Env, name: string, value: string, maxAge: number): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${maxAge}`,
    "SameSite=Lax",
  ];
  if (env.NODE_ENV === "production") {
    attrs.push("Secure");
  }
  return attrs.join("; ");
}

async function getSession(req: IncomingMessage): Promise<SessionPayload | null> {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

async function requireSession(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<SessionPayload | null> {
  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { error: "unauthorized" });
    return null;
  }
  return session;
}

/** Allowed browser origins for CORS. With the Vercel-rewrite proxy, requests
 *  arrive same-origin (no CORS involved); this list covers the proxy origin
 *  (APP_URL/DASHBOARD_URL = the Vercel URL) and local dev. */
function allowedOrigins(env: Env): string[] {
  const origins = new Set<string>();
  if (env.DASHBOARD_URL) origins.add(env.DASHBOARD_URL);
  if (env.APP_URL) origins.add(env.APP_URL);
  origins.add("http://localhost:3000");
  origins.add("http://127.0.0.1:3000");
  return [...origins];
}

function corsHeaders(req: IncomingMessage, env: Env): Record<string, string> {
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  approximate_member_count?: number;
}

async function fetchUserGuilds(session: SessionPayload): Promise<DiscordGuild[] | null> {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  }).catch(() => null);
  if (!res?.ok) return null;
  const guilds = (await res.json().catch(() => null)) as DiscordGuild[] | null;
  return Array.isArray(guilds) ? guilds : null;
}

async function userManagesGuild(session: SessionPayload, guildId: string): Promise<boolean> {
  const guilds = await fetchUserGuilds(session);
  const guild = guilds?.find((g) => g.id === guildId);
  if (!guild) return false;
  return guild.owner || (BigInt(guild.permissions) & 0x20n) === 0x20n;
}

// ── Route handlers ──────────────────────────────────────────────────────────

const authLogin: Handler = async (req, res) => {
  const env = getEnv();
  const state = oauthStateSecret();
  res.setHeader(
    "Set-Cookie",
    sessionCookie(env, STATE_COOKIE, state, 600),
  );
  redirect(res, discordOAuthUrl(state));
};

const authCallback: Handler = async (req, res, _params, query) => {
  const env = getEnv();
  const code = query.get("code");
  const state = query.get("state");
  const cookies = parseCookies(req);
  const expected = cookies[STATE_COOKIE];

  const frontendBase = env.DASHBOARD_URL ?? env.APP_URL;
  if (!code || !state || !expected || state !== expected) {
    redirect(res, `${frontendBase}/?auth=failed`);
    return;
  }
  res.setHeader("Set-Cookie", sessionCookie(env, STATE_COOKIE, "", 0));

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: `${env.APP_URL}/api/auth/callback`,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed (${tokenRes.status})`);
    const tokenData = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) throw new Error(`user fetch failed (${userRes.status})`);
    const user = (await userRes.json()) as { id: string; username: string; avatar: string | null };

    const jwt = await signSessionToken({
      userId: user.id,
      username: user.username,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
        : "",
      accessToken: tokenData.access_token,
    });

    res.setHeader("Set-Cookie", sessionCookie(env, SESSION_COOKIE, jwt, 60 * 60 * 24 * 7));
    redirect(res, `${frontendBase}/dashboard`);
  } catch (err) {
    console.error("[slux] OAuth callback error:", err);
    redirect(res, `${frontendBase}/?auth=failed`);
  }
};

const authLogout: Handler = async (req, res) => {
  const env = getEnv();
  res.setHeader("Set-Cookie", sessionCookie(env, SESSION_COOKIE, "", 0));
  sendJson(res, 200, { ok: true });
};

const authMe: Handler = async (req, res) => {
  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { authenticated: false });
    return;
  }
  sendJson(res, 200, {
    authenticated: true,
    user: { id: session.userId, username: session.username, avatar: session.avatar },
  });
};

const stats: Handler = async (req, res) => {
  const bot = getBot();
  let servers = 0;
  let players = 0;
  let users = 0;
  if (bot) {
    servers = bot.client.guilds.cache.size;
    players = bot.music.stats().players;
    for (const guild of bot.client.guilds.cache.values()) {
      users += guild.memberCount ?? 0;
    }
  }
  sendJson(res, 200, {
    servers,
    players,
    users,
    commands: COMMAND_COUNT,
    uptime: bot?.uptimeSeconds ?? 0,
  });
};

const guilds: Handler = async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const list = await fetchUserGuilds(session);
  if (list === null) {
    sendJson(res, 401, { error: "discord_unauthorized" });
    return;
  }
  const bot = getBot();
  const manageable = list
    .filter((g) => g.owner || (BigInt(g.permissions) & 0x20n) === 0x20n)
    .map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
      memberCount: bot?.client.guilds.cache.get(g.id)?.memberCount ?? g.approximate_member_count ?? null,
      botPresent: !!bot?.client.guilds.cache.has(g.id),
    }))
    .sort((a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name));

  sendJson(res, 200, { guilds: manageable, inviteUrl: inviteUrl(getEnv().DISCORD_CLIENT_ID) });
};

const settingsPatchSchema = z.object({
  prefix: z.string().min(1).max(5).regex(/^\S+$/).optional(),
  language: z.enum(["en", "hi", "es", "fr", "de", "pt"]).optional(),
  djRoles: z.array(z.string().regex(/^\d{17,20}$/)).max(10).optional(),
  botChannels: z.array(z.string().regex(/^\d{17,20}$/)).max(20).optional(),
  defaultVolume: z.number().int().min(0).max(150).optional(),
  defaultAutoplay: z.boolean().optional(),
  default247: z.boolean().optional(),
  idleTimeout: z.number().int().min(0).max(120).optional(),
});

const guildSettingsGet: Handler = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const guildId = params.guildId!;

  const bot = getBot();
  const guild = bot?.client.guilds.cache.get(guildId);
  if (!bot || !guild) {
    sendJson(res, 404, { error: "bot not in guild" });
    return;
  }
  if (!(await userManagesGuild(session, guildId))) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const settings = await getGuildSettings(guildId);
  sendJson(res, 200, {
    settings,
    guild: {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 }),
      roles: guild.roles.cache
        .filter((r) => !r.managed && r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
        .slice(0, 50),
      textChannels: guild.channels.cache
        .filter((c) => c.type === 0 || c.type === 5)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map((c) => ({ id: c.id, name: c.name })),
      voiceChannels: guild.channels.cache
        .filter((c) => c.isVoiceBased())
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map((c) => ({ id: c.id, name: c.name })),
    },
  });
};

const guildSettingsPatch: Handler = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const guildId = params.guildId!;

  const bot = getBot();
  if (!bot?.client.guilds.cache.has(guildId)) {
    sendJson(res, 404, { error: "bot not in guild" });
    return;
  }
  if (!(await userManagesGuild(session, guildId))) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const body = await readBody(req).catch(() => null);
  const parsed = settingsPatchSchema.safeParse(body ? JSON.parse(body) : null);
  if (!parsed.success) {
    sendJson(res, 400, { error: "invalid payload", issues: parsed.error.issues });
    return;
  }

  const settings = await updateGuildSettings(guildId, parsed.data);
  bot.invalidateGuild(guildId);
  sendJson(res, 200, { settings, languages: LOCALES.map((l) => l.code) });
};

const playerState: Handler = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const guildId = params.guildId!;

  const bot = getBot();
  if (!bot) {
    sendJson(res, 503, { error: "bot unavailable" });
    return;
  }
  const guild = bot.client.guilds.cache.get(guildId);
  if (!guild) {
    sendJson(res, 404, { error: "bot not in guild" });
    return;
  }

  const player = bot.music.getPlayer(guildId);
  const voiceChannels = guild.channels.cache
    .filter((c) => c.isVoiceBased())
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name }));
  const settings = await getGuildSettings(guildId);

  sendJson(res, 200, {
    snapshot: player?.snapshot() ?? null,
    voiceChannels,
    guild: { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 128 }) },
    settings: { language: settings.language, defaultVolume: settings.defaultVolume },
  });
};

const lyrics: Handler = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const guildId = params.guildId!;

  const bot = getBot();
  if (!bot) {
    sendJson(res, 503, { error: "bot unavailable" });
    return;
  }
  const player = bot.music.getPlayer(guildId);
  const current = player?.current ?? null;
  if (!current) {
    sendJson(res, 200, { lyrics: null });
    return;
  }
  const result = await bot.music.lyricsForTrack(guildId, {
    title: current.title,
    author: current.author,
  });
  sendJson(res, 200, { lyrics: result });
};

const search: Handler = async (req, res, _params, query) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const q = query.get("q");
  if (!q || q.trim().length < 2) {
    sendJson(res, 200, { results: [] });
    return;
  }
  const bot = getBot();
  if (!bot) {
    sendJson(res, 503, { error: "bot unavailable" });
    return;
  }
  const results = await bot.music.search(q, 10);
  sendJson(res, 200, { results });
};

const playlistsCreateSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(256).optional().default(""),
});

const playlistsList: Handler = async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const playlists = await PlaylistModel.find({ ownerId: session.userId })
    .select("name description tracks public createdAt updatedAt")
    .lean();
  sendJson(res, 200, {
    playlists: playlists.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      trackCount: p.tracks?.length ?? 0,
      public: p.public,
      tracks: (p.tracks ?? []).slice(0, 500),
      updatedAt: p.updatedAt,
    })),
  });
};

const playlistsCreate: Handler = async (req, res) => {
  const session = await requireSession(req, res);
  if (!session) return;

  const body = await readBody(req).catch(() => null);
  const parsed = playlistsCreateSchema.safeParse(body ? JSON.parse(body) : null);
  if (!parsed.success) {
    sendJson(res, 400, { error: "invalid payload" });
    return;
  }
  const { name, description } = parsed.data;
  const exists = await PlaylistModel.findOne({ ownerId: session.userId, name });
  if (exists) {
    sendJson(res, 409, { error: "playlist exists" });
    return;
  }
  const playlist = await PlaylistModel.create({ ownerId: session.userId, name, description, tracks: [] });
  sendJson(res, 200, {
    playlist: {
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      trackCount: 0,
      public: playlist.public,
      tracks: [],
    },
  });
};

const playlistPatchSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(256).optional(),
  public: z.boolean().optional(),
  addTrack: z
    .object({
      encoded: z.string(),
      title: z.string(),
      author: z.string(),
      length: z.number(),
      uri: z.string().optional().default(""),
      artwork: z.string().optional().default(""),
      sourceName: z.string().optional().default("unknown"),
      identifier: z.string().optional().default(""),
      isrc: z.string().optional().default(""),
      isStream: z.boolean().optional().default(false),
    })
    .optional(),
  removeTrackIndex: z.number().int().min(1).optional(),
});

async function findPlaylist(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  return PlaylistModel.findById(id);
}

const playlistGet: Handler = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const playlist = await findPlaylist(params.id!);
  if (!playlist) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (!playlist.public && playlist.ownerId !== session.userId) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  sendJson(res, 200, {
    playlist: {
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      public: playlist.public,
      tracks: playlist.tracks,
      ownerId: playlist.ownerId,
    },
  });
};

const playlistPatch: Handler = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const playlist = await findPlaylist(params.id!);
  if (!playlist) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (playlist.ownerId !== session.userId) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  const body = await readBody(req).catch(() => null);
  const parsed = playlistPatchSchema.safeParse(body ? JSON.parse(body) : null);
  if (!parsed.success) {
    sendJson(res, 400, { error: "invalid payload" });
    return;
  }

  const { name, description, public: isPublic, addTrack, removeTrackIndex } = parsed.data;

  if (name !== undefined) {
    const clash = await PlaylistModel.findOne({
      ownerId: session.userId,
      name,
      _id: { $ne: playlist._id },
    });
    if (clash) {
      sendJson(res, 409, { error: "playlist exists" });
      return;
    }
    playlist.name = name;
  }
  if (description !== undefined) playlist.description = description;
  if (isPublic !== undefined) playlist.public = isPublic;

  if (addTrack) {
    if (playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
      sendJson(res, 400, { error: "playlist full" });
      return;
    }
    playlist.tracks.push({ ...addTrack });
  }
  if (removeTrackIndex !== undefined) {
    if (removeTrackIndex < 1 || removeTrackIndex > playlist.tracks.length) {
      sendJson(res, 400, { error: "bad index" });
      return;
    }
    playlist.tracks.splice(removeTrackIndex - 1, 1);
  }

  await playlist.save();
  sendJson(res, 200, {
    playlist: {
      id: playlist._id.toString(),
      name: playlist.name,
      description: playlist.description,
      public: playlist.public,
      tracks: playlist.tracks,
      ownerId: playlist.ownerId,
    },
  });
};

const playlistDelete: Handler = async (req, res, params) => {
  const session = await requireSession(req, res);
  if (!session) return;
  const playlist = await findPlaylist(params.id!);
  if (!playlist) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  if (playlist.ownerId !== session.userId) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  await PlaylistModel.deleteOne({ _id: playlist._id });
  sendJson(res, 200, { ok: true });
};

// ── Router ──────────────────────────────────────────────────────────────────

const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [
  { method: "GET", pattern: /^\/api\/auth\/login$/, keys: [], handler: authLogin },
  { method: "GET", pattern: /^\/api\/auth\/callback$/, keys: [], handler: authCallback },
  { method: "POST", pattern: /^\/api\/auth\/logout$/, keys: [], handler: authLogout },
  { method: "GET", pattern: /^\/api\/auth\/me$/, keys: [], handler: authMe },
  { method: "GET", pattern: /^\/api\/stats$/, keys: [], handler: stats },
  { method: "GET", pattern: /^\/api\/guilds$/, keys: [], handler: guilds },
  {
    method: "GET",
    pattern: /^\/api\/guilds\/(\d{17,20})\/settings$/,
    keys: ["guildId"],
    handler: guildSettingsGet,
  },
  {
    method: "PATCH",
    pattern: /^\/api\/guilds\/(\d{17,20})\/settings$/,
    keys: ["guildId"],
    handler: guildSettingsPatch,
  },
  { method: "GET", pattern: /^\/api\/player\/(\d{17,20})$/, keys: ["guildId"], handler: playerState },
  { method: "GET", pattern: /^\/api\/lyrics\/(\d{17,20})$/, keys: ["guildId"], handler: lyrics },
  { method: "GET", pattern: /^\/api\/search$/, keys: [], handler: search },
  { method: "GET", pattern: /^\/api\/playlists$/, keys: [], handler: playlistsList },
  { method: "POST", pattern: /^\/api\/playlists$/, keys: [], handler: playlistsCreate },
  { method: "GET", pattern: /^\/api\/playlists\/([a-f\d]{24})$/i, keys: ["id"], handler: playlistGet },
  { method: "PATCH", pattern: /^\/api\/playlists\/([a-f\d]{24})$/i, keys: ["id"], handler: playlistPatch },
  { method: "DELETE", pattern: /^\/api\/playlists\/([a-f\d]{24})$/i, keys: ["id"], handler: playlistDelete },
];

/** Create the /api request handler for the raw Node HTTP server. */
export function createApiHandler() {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const env = getEnv();
    const cors = corsHeaders(req, env);

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    // Merge CORS headers into every response this request sends (handlers
    // call writeHead themselves; explicit headers win over CORS).
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = ((status: number, ...rest: unknown[]) => {
      const explicit = rest.find((a) => a !== null && typeof a === "object") as
        | Record<string, string | string[]>
        | undefined;
      const merged: Record<string, string | string[]> = { ...cors, ...(explicit ?? {}) };
      if (Object.keys(merged).length === 0) return originalWriteHead(status as never);
      return originalWriteHead(status as never, merged as never);
    }) as typeof res.writeHead;

    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const path = url.pathname;
      const query = url.searchParams;

      for (const route of routes) {
        if (route.method !== req.method) continue;
        const match = route.pattern.exec(path);
        if (!match) continue;
        const params: Record<string, string> = {};
        route.keys.forEach((key, i) => {
          params[key] = match[i + 1]!;
        });
        await route.handler(req, res, params, query);
        return;
      }
      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      console.error("[slux] API error:", err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "internal error" });
      } else {
        res.end();
      }
    }
  };
}
