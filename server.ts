import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { BotService } from "@/bot/bot";
import { setBot, getBot } from "@/lib/bot-singleton";
import { connectDatabase, disconnectDatabase } from "@/db/connect";
import { getEnv } from "@/lib/env";
import { verifySessionToken } from "@/lib/jwt";
import { getGuildSettings } from "@/db/repositories/guilds";
import { emptyPlayerSnapshot } from "@/bot/music/types";
import { createApiHandler } from "@/server/api";

try {
  process.loadEnvFile();
} catch {
  /* .env is optional */
}

const env = getEnv();
const port = parseInt(process.env.PORT ?? "3001", 10);

/**
 * Backend entry: Discord bot + HTTP API + socket.io.
 *
 * The dashboard frontend (Next.js) is deployed separately (e.g. Vercel) and
 * talks to this server via NEXT_PUBLIC_API_URL. Non-API requests are
 * redirected to the dashboard site (DASHBOARD_URL).
 *
 * Set DASHBOARD_ENABLED=false to run a pure bot with no web surface at all.
 */

function healthz(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
}

function redirectToFrontend(req: IncomingMessage, res: ServerResponse): void {
  if (env.DASHBOARD_URL) {
    res.writeHead(302, { Location: env.DASHBOARD_URL + (req.url ?? "/") });
    res.end();
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(
    "Slux backend is running.\n" +
      "The dashboard is deployed separately — set DASHBOARD_URL so this server can redirect to it.\n",
  );
}

async function main() {
  console.log("[slux] Booting backend...");

  const dashboardEnabled = env.DASHBOARD_ENABLED;
  if (!dashboardEnabled) {
    console.log("[slux] Dashboard DISABLED (DASHBOARD_ENABLED=false) — bot-only mode");
  }

  const apiHandler = createApiHandler();

  const httpServer = createServer((req, res) => {
    try {
      // Health probe for hosting platforms
      if (req.url === "/healthz") return healthz(req, res);
      // Socket.io owns /socket.io requests
      if (req.url?.startsWith("/socket.io")) return;
      if (dashboardEnabled && req.url?.startsWith("/api")) {
        void apiHandler(req, res);
        return;
      }
      if (!dashboardEnabled && req.url?.startsWith("/api")) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "dashboard disabled" }));
        return;
      }
      // Everything else belongs to the frontend site
      redirectToFrontend(req, res);
    } catch (err) {
      console.error("[slux] HTTP handler error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal error" }));
      }
    }
  });

  // ── Dashboard realtime (socket.io) — only when the dashboard is enabled ──

  let io: SocketIOServer | null = null;
  let dashboard: ReturnType<SocketIOServer["of"]> | null = null;

  if (dashboardEnabled) {
    // With the Vercel-rewrite proxy, socket connections arrive same-origin;
    // the allowlist covers the proxy origin (APP_URL/DASHBOARD_URL = the
    // Vercel URL) and local dev.
    const socketOrigins = [
      ...new Set(
        [
          env.DASHBOARD_URL,
          env.APP_URL,
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ].filter((o): o is string => Boolean(o)),
      ),
    ];
    io = new SocketIOServer(httpServer, {
      path: "/socket.io",
      cors: { origin: socketOrigins, credentials: true },
    });
    dashboard = io.of("/dashboard");

    dashboard.use(async (socket, next) => {
      const cookie = socket.handshake.headers.cookie ?? "";
      const token = /slux_session=([^;]+)/.exec(cookie)?.[1];
      if (!token) return next(new Error("unauthorized"));
      try {
        const session = await verifySessionToken(decodeURIComponent(token));
        (socket.data as { userId?: string }).userId = session.userId;
        next();
      } catch {
        next(new Error("unauthorized"));
      }
    });

    dashboard.on("connection", (socket: Socket) => {
      const userId = (socket.data as { userId?: string }).userId;

      socket.on("guild:join", (guildId: unknown) => {
        try {
          if (typeof guildId !== "string") return;
          socket.data.guildId = guildId;
          void socket.join(`guild:${guildId}`);
          const botNow = getBot();
          const player = botNow?.music.getPlayer(guildId);
          if (player) {
            socket.emit("player:snapshot", player.snapshot());
          } else {
            const guild = botNow?.client.guilds.cache.get(guildId);
            socket.emit("player:snapshot", emptyPlayerSnapshot(guildId, guild?.name ?? ""));
          }
        } catch (err) {
          console.error("[slux] socket guild:join error:", err);
        }
      });

      socket.on("guild:leave", (guildId: unknown) => {
        try {
          if (typeof guildId !== "string") return;
          void socket.leave(`guild:${guildId}`);
        } catch (err) {
          console.error("[slux] socket guild:leave error:", err);
        }
      });

      socket.on("player:action", (payload: unknown, ack?: (result: unknown) => void) => {
        handlePlayerAction(userId, payload)
          .then((result) => ack?.(result))
          .catch((err) => {
            console.error("[slux] socket player:action error:", err);
            ack?.({ ok: false, error: "internal error" });
          });
      });

      socket.on("error", (err) => {
        console.error("[slux] socket error:", err?.message ?? String(err));
      });
    });
  }

  const wireBotBus = (bot: BotService) => {
    bot.bus.on("snapshot", (snapshot) => {
      dashboard?.to(`guild:${snapshot.guildId}`).emit("player:snapshot", snapshot);
    });
    bot.bus.on("playerDestroy", ({ guildId }) => {
      dashboard?.to(`guild:${guildId}`).emit("player:snapshot", emptyPlayerSnapshot(guildId));
    });
  };

  async function handlePlayerAction(
    userId: string | undefined,
    payload: unknown,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      if (!userId) return { ok: false, error: "unauthorized" };
      const data = payload as {
        guildId?: string;
        action?: string;
        value?: unknown;
        track?: unknown;
      };
      const botNow = getBot();
      if (!botNow || !data.guildId || typeof data.action !== "string") {
        return { ok: false, error: "bad request" };
      }
      const guild = botNow.client.guilds.cache.get(data.guildId);
      if (!guild) return { ok: false, error: "unknown guild" };
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return { ok: false, error: "not a member" };

      const settings = await getGuildSettings(data.guildId);
      let player = botNow.music.getPlayer(data.guildId);

      const action = data.action;

      // Create player for join actions
      if (action === "join") {
        const channelId = typeof data.value === "string" ? data.value : member.voice.channelId;
        if (!channelId) return { ok: false, error: "no voice channel" };
        const channel = guild.channels.cache.get(channelId);
        if (!channel?.isVoiceBased?.()) return { ok: false, error: "invalid channel" };
        const created = await botNow.music.createPlayer(member, channel, null);
        if (!created) return { ok: false, error: "join failed" };
        player = created;
        await player.setVolume(settings.defaultVolume).catch(() => {});
        player.autoplay = settings.defaultAutoplay;
        player.stayInChannel = settings.default247;
        player.setIdleTimeout(settings.idleTimeout);
        await player.refreshLocale();
        return { ok: true };
      }

      if (!player) return { ok: false, error: "no player" };
      if (!botNow.canControl(member, settings, player)) {
        return { ok: false, error: "dj mode" };
      }

      const value = data.value;

      switch (action) {
        case "play": {
          const encoded = (data.track as { encoded?: string } | undefined)?.encoded;
          if (typeof encoded === "string" && encoded) {
            const track = await botNow.music.decode(encoded, {
              id: member.id,
              tag: member.user.tag,
              avatar: member.user.displayAvatarURL({ size: 64 }),
            });
            if (track) {
              const wasEmpty = !player.current;
              player.enqueue(track);
              if (wasEmpty) await player.startIfIdle();
            }
          } else if (typeof value === "string" && value.trim()) {
            const outcome = await botNow.music.resolve(value, {
              id: member.id,
              tag: member.user.tag,
              avatar: member.user.displayAvatarURL({ size: 64 }),
            });
            if (outcome.kind === "track" && outcome.track) {
              const wasEmpty = !player.current;
              player.enqueue(outcome.track);
              if (wasEmpty) await player.startIfIdle();
            } else if (outcome.kind === "playlist" && outcome.tracks) {
              player.enqueueMany(outcome.tracks);
              if (!player.current) await player.startIfIdle();
            } else if (outcome.kind === "search" && outcome.tracks && outcome.tracks.length > 0) {
              const wasEmpty = !player.current;
              player.enqueue(outcome.tracks[0]);
              if (wasEmpty) await player.startIfIdle();
            } else {
              return { ok: false, error: "nothing found" };
            }
          } else {
            return { ok: false, error: "bad request" };
          }
          return { ok: true };
        }
        case "pause":
          await player.pause();
          return { ok: true };
        case "resume":
          await player.resume();
          return { ok: true };
        case "toggle":
          if (player.paused) await player.resume();
          else await player.pause();
          return { ok: true };
        case "skip":
          await player.skip();
          return { ok: true };
        case "previous":
          await player.previous();
          return { ok: true };
        case "stop":
          await botNow.music.destroyPlayer(data.guildId, "stopped");
          return { ok: true };
        case "seek": {
          const ms = Number(value);
          if (!Number.isFinite(ms)) return { ok: false, error: "bad request" };
          await player.seek(ms);
          return { ok: true };
        }
        case "volume": {
          const vol = Number(value);
          if (!Number.isFinite(vol) || vol < 0 || vol > 150) return { ok: false, error: "bad volume" };
          await player.setVolume(vol);
          return { ok: true };
        }
        case "loop": {
          const mode = value === "off" || value === "track" || value === "queue" ? value : player.cycleRepeat();
          await player.setRepeat(mode);
          return { ok: true };
        }
        case "shuffle":
          player.shuffleQueue();
          return { ok: true };
        case "clear":
          player.clearQueue();
          return { ok: true };
        case "remove": {
          const index = Number(value);
          if (!Number.isFinite(index) || index < 1 || index > player.queue.length) {
            return { ok: false, error: "bad index" };
          }
          player.removeAt(index);
          return { ok: true };
        }
        case "moveTop": {
          const index = Number(value);
          if (!Number.isFinite(index) || index < 2 || index > player.queue.length) {
            return { ok: false, error: "bad index" };
          }
          player.moveTrack(index, 1);
          return { ok: true };
        }
        case "move": {
          const move = value as { from?: number; to?: number };
          const from = Number(move?.from);
          const to = Number(move?.to);
          if (!Number.isFinite(from) || !Number.isFinite(to)) return { ok: false, error: "bad request" };
          player.moveTrack(from, to);
          return { ok: true };
        }
        case "autoplay":
          player.autoplay = !player.autoplay;
          player.emit();
          return { ok: true };
        case "247":
          player.stayInChannel = !player.stayInChannel;
          player.emit();
          return { ok: true };
        case "djmode":
          player.djMode = !player.djMode;
          player.emit();
          return { ok: true };
        case "filter": {
          const name = (value as { name?: string; on?: boolean; param?: unknown })?.name;
          if (typeof name !== "string") return { ok: false, error: "bad request" };
          const on = (value as { on?: boolean }).on !== false;
          if (on) await player.applyFilter(name, (value as { param?: unknown }).param);
          else await player.removeFilter(name);
          return { ok: true };
        }
        case "resetFilters":
          await player.resetFilters();
          return { ok: true };
        default:
          return { ok: false, error: "unknown action" };
      }
    } catch (err) {
      console.error("[slux] socket action error:", err);
      return { ok: false, error: "internal error" };
    }
  }

  httpServer.listen(port, env.HOST, () => {
    console.log(
      `[slux] Backend ready on ${env.APP_URL} (bound to ${env.HOST}:${port}) — ` +
        (dashboardEnabled
          ? `dashboard at ${env.DASHBOARD_URL ?? "(set DASHBOARD_URL)"}`
          : "dashboard disabled"),
    );
  });

  // Connect the database after the HTTP server is up; retry forever in the
  // background so transient MongoDB outages degrade instead of crash-looping.
  const connectDbWithRetry = async (attempt = 1): Promise<void> => {
    try {
      await connectDatabase();
      console.log("[slux] MongoDB connected");
    } catch (err) {
      console.error(
        `[slux] MongoDB connection failed (attempt ${attempt}):`,
        err instanceof Error ? err.message : err,
      );
      setTimeout(() => void connectDbWithRetry(attempt + 1), Math.min(30_000, attempt * 5_000));
    }
  };
  void connectDbWithRetry();

  // Lavalink nodes (3rd-party, optional backup) connect via Shoukaku when
  // the Discord client is ready — no provisioning step is needed.
  const bot = getBot() ?? new BotService();
  setBot(bot);
  wireBotBus(bot);
  const loginWithRetry = async (attempt = 1): Promise<void> => {
    try {
      await bot.login();
      console.log("[slux] Discord gateway connected");
    } catch (err) {
      console.error(
        `[slux] Discord login failed (attempt ${attempt}):`,
        err instanceof Error ? err.message : err,
      );
      const delay = Math.min(300_000, attempt * 15_000);
      setTimeout(() => void loginWithRetry(attempt + 1), delay).unref?.();
    }
  };
  void loginWithRetry();

  const shutdown = async () => {
    console.log("[slux] Shutting down...");
    io?.close();
    await bot.shutdown().catch(() => {});
    await disconnectDatabase().catch(() => {});
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

void main().catch((err) => {
  console.error("[slux] Fatal boot error:", err);
  process.exit(1);
});

// ── Global error safety net ──────────────────────────────────────────────────
// Any error that escapes handlers lands here: logged once per unique message
// per 10 seconds (identical repeats are swallowed) so a crash loop can never
// flood the console, and the process never dies from a stray exception.
const lastLogged = new Map<string, number>();
function reportGlobalError(kind: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const now = Date.now();
  const last = lastLogged.get(message) ?? 0;
  if (now - last < 10_000) return;
  lastLogged.set(message, now);
  if (lastLogged.size > 500) lastLogged.clear();
  console.error(`[slux] ${kind}:`, err instanceof Error ? err.stack ?? err.message : err);
}
process.on("uncaughtException", (err) => reportGlobalError("uncaughtException", err));
process.on("unhandledRejection", (reason) => reportGlobalError("unhandledRejection", reason));
