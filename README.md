# Slux — Discord Music Bot + Web Dashboard

A feature-rich, free-forever Discord music bot with a beautiful real-time web dashboard. Built with TypeScript, discord.js, Shoukaku/Lavalink, Next.js 15 and MongoDB.

- **All sources**: YouTube, YouTube Music, Spotify, SoundCloud, Deezer, Apple Music, Tidal (via LavaSrc)
- **62 commands** — slash **and** configurable prefix
- **Studio filters**: bassboost (4 levels), nightcore, vaporwave, 8D, karaoke, tremolo, vibrato, distortion, lowpass, speed, pitch, custom 15-band EQ
- **Real-time dashboard**: live player control, queue management, search, synced lyrics, guild settings, playlist manager
- **Autoplay**, **24/7 mode**, **DJ mode**, favorites, custom playlists (up to 1000 tracks), grab-to-DM, interactive search selection, sleep timer, skip-to-position, duplicate removal
- **Node failover**: main + optional backup Lavalink node with automatic switchover
- **6 languages**: English, हिन्दी, Español, Français, Deutsch, Português
- **No premium tiers** — everything free

## Architecture (split deployment)

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  BACKEND (any Node host)│         │  FRONTEND (Vercel)       │
│  - Discord bot          │  HTTPS  │  - Next.js dashboard     │
│  - REST API  /api/*     │◄───────►│  - marketing site        │
│  - socket.io /socket.io │ cookies │  - NEXT_PUBLIC_API_URL   │
│  - MongoDB              │         │    points at backend     │
└─────────────────────────┘         └──────────────────────────┘
```

The backend (`server.ts` → `dist/server.js`) runs the bot, the REST API and the socket server. The frontend is a pure Next.js app deployed on Vercel; it talks to the backend via `NEXT_PUBLIC_API_URL` with cross-origin cookies. The dashboard is **optional**: `DASHBOARD_ENABLED=false` runs a pure bot with no web surface at all.

| Layer | Tech |
|---|---|
| Bot + API | discord.js v14 + Shoukaku 4 + raw Node HTTP + socket.io |
| Audio | 3rd-party Lavalink v4 nodes (LavaSrc, LavaSearch, LavaLyrics plugins) |
| Dashboard | Next.js 15 (App Router) on Vercel |
| Database | MongoDB (Atlas) + Mongoose |
| Auth | Discord OAuth2 on the backend → JWT (jose) httpOnly cookie |

## Development

Prerequisites: Node.js ≥ 20, pnpm ≥ 9.

```powershell
# 1. Install dependencies
pnpm install

# 2. Configure
Copy-Item .env.example .env   # fill in the required values

# 3. Run — backend on :3001, Next dev on :3000 (already wired together)
pnpm dev
```

> Note: Windows PowerShell 5.1 does not support `&&` between commands — run each command on its own line (as shown) or use `;`.

The dev runner sets `NEXT_PUBLIC_API_URL=http://localhost:3001` for the frontend and `PORT=3001` for the backend automatically. Open http://localhost:3000.

## Lavalink: 3rd-party nodes

Slux connects to hosted Lavalink v4 nodes — no Docker or self-hosting required. The node **must** run the LavaSrc + LavaSearch + LavaLyrics plugins for search, source resolution and lyrics to work (most public nodes do).

```env
# Main node
LAVALINK_HOST=lavalink.example.com
LAVALINK_PORT=443
LAVALINK_PASS=your-node-password
LAVALINK_SECURE=true        # wss/https — most hosted nodes use this
LAVALINK_NAME=main
```

### Optional backup node (automatic failover)

Set `LAVALINK_BACKUP_HOST` and the bot keeps a second node ready. Shoukaku routes every request to the healthiest connected node (by penalties: player count, CPU load), so when the main node is **offline or busy** the backup takes over automatically — and traffic returns to the main node once it recovers. Active players migrate between nodes on disconnect.

```env
LAVALINK_BACKUP_HOST=backup.lavalink.example.com
LAVALINK_BACKUP_PORT=443
LAVALINK_BACKUP_PASS=other-node-password
LAVALINK_BACKUP_SECURE=true
LAVALINK_BACKUP_NAME=backup
```

Use `/nodes` in Discord to see live status of all configured nodes.

## Deployment

### 1. Backend (bot + API) — any Node 20+ host

Railway / Render / Fly.io / VPS / panel — anything that runs Node:

```bash
pnpm install
pnpm build:server     # → dist/server.js
node dist/server.js   # start (binds HOST:PORT, defaults 0.0.0.0:3001)
```

Environment (see `.env.example`): `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `MONGODB_URI` (Atlas), `LAVALINK_*`, plus:

- `APP_URL` — the backend's **public** URL (e.g. `https://slux-bot.up.railway.app`)
- `DASHBOARD_URL` — your Vercel URL (e.g. `https://slux.vercel.app`) — used for CORS, bot embed links and the post-login redirect
- `DASHBOARD_ENABLED=false` — **optional**: run a pure bot. No API, no socket server, no dashboard links in embeds, and `DISCORD_CLIENT_SECRET`/`SESSION_SECRET` become unnecessary.

The backend exposes `/healthz` for uptime probes.

### 2. Frontend (dashboard) — Vercel

1. Import the repo as a Vercel project (Next.js is auto-detected; `pnpm build` runs `next build`).
2. Set the environment variables in Vercel → Settings → Environment Variables:
   - `NEXT_PUBLIC_API_URL` — your backend URL (e.g. `https://slux-bot.up.railway.app`)
   - `NEXT_PUBLIC_DISCORD_CLIENT_ID` — your Discord application id (for invite links)
3. Deploy. No secrets live on Vercel — only public values.

### 3. Discord OAuth setup

On the Developer Portal → OAuth2, the redirect URI must be the **backend's** callback:

```
https://<backend-url>/api/auth/callback
```

(e.g. `https://slux-bot.up.railway.app/api/auth/callback`)

Login flow: user clicks Login on the dashboard → backend `/api/auth/login` → Discord → backend `/api/auth/callback` sets the session cookie on the backend domain → redirect to `DASHBOARD_URL/dashboard`. The dashboard then authenticates every API/socket call with that cookie (cross-origin cookies use `SameSite=None; Secure` in production).

### Panel-style hosting (Pterodactyl, `node JS_FILE` startup)

Panels that run `node /home/container/${JS_FILE}` can't run TypeScript — build first, then upload:

1. Locally: `pnpm install` then `pnpm build:server` → produces `dist/server.js`.
2. Upload `dist/` (plus `.env`, `package.json`) to the container; set `JS_FILE=dist/server.js`, `AUTO_UPDATE=0`, `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=<allocated>`, and use a Node 20+ image.
3. Let the panel's `npm install` finish (retry if OOM-killed; a partially killed `node_modules` should be deleted and retried).
4. The frontend still runs on Vercel — set its `NEXT_PUBLIC_API_URL` to the panel's public URL.

Note: panels usually don't provide public HTTPS URLs — the dashboard needs `NEXT_PUBLIC_API_URL` to be reachable from browsers and to allow the OAuth redirect, so a host with a public HTTPS domain (Railway/Render/VPS) is the smoother choice.

## Discord Application Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** page: create the bot, copy the token into `DISCORD_TOKEN`, and enable the **Message Content Intent** (privileged intent, required for prefix commands).
3. **OAuth2** page: copy Client ID/Secret into `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, and add the redirect URI `https://<backend-url>/api/auth/callback`.
4. Generate a session secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
5. Invite the bot with the link on the dashboard guild picker (or `/invite`). Required permissions: View Channels, Send Messages, Embed Links, Read Message History, Use External Emojis, Manage Messages, Connect, Speak, **Set Voice Channel Status** (for the live "now playing" channel status — grant it to the bot's role if it was invited before this feature).

## Environment Variables

See `.env.example`. Backend requires `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `MONGODB_URI` and the `LAVALINK_*` block; `DISCORD_CLIENT_SECRET` + `SESSION_SECRET` (32+ chars) are only required when the dashboard is enabled. Frontend (Vercel) needs `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_DISCORD_CLIENT_ID`.

## Usage

- **Slash commands**: `/play never gonna give you up`
- **Prefix commands**: `!play <query>` (mention also works as prefix; change with `/prefix`)
- **Mention the bot** (`@Slux`) anywhere for a quick-start card with this server's prefix and popular commands.
- **Dashboard**: login with Discord → pick a server → control the player, edit settings, manage playlists from your browser.

Try: `!play <song>`, `!search <query>` (button picker), `!lyrics`, `!bassboost insane`, `!autoplay`, `!247`, `!sleep 30`, `!skipto 3`, `!removeduplicates`, `!playlist save chill`, `!favorites add`, `!nodes`.

## Troubleshooting

- **Bot never connects to Lavalink**: verify host/port/password with your provider, and that `LAVALINK_SECURE=true` is set for TLS nodes. Run `/nodes` to see live node status.
- **Dashboard can't reach the API**: check `NEXT_PUBLIC_API_URL` on Vercel (no trailing slash), that the backend URL is public HTTPS, and `DASHBOARD_URL` on the backend matches the Vercel URL exactly (CORS is strict).
- **Login loops / "unauthorized"**: the OAuth redirect on the portal must exactly equal `https://<backend-url>/api/auth/callback`; cross-origin cookies require HTTPS on both ends.
- **YouTube "Sign in to confirm you're not a bot"**: the node's provider may be rate-limited — ask your provider or switch nodes. Other sources are unaffected.

## Project Structure

```
server.ts                 # backend entry: HTTP + API + socket.io + bot
scripts/dev.mjs           # dev runner: backend watch (:3001) + next dev (:3000)
src/
├─ app/                   # Next.js App Router (marketing + dashboard pages, Vercel)
├─ server/api.ts          # backend REST API (auth, guilds, player, lyrics, playlists)
├─ bot/
│  ├─ bot.ts              # BotService: client, Shoukaku, handlers, slash registration
│  ├─ commands/           # 62 commands across music/playlists/filters/settings/info
│  ├─ music/              # MusicManager (search/resolve/lyrics) + GuildPlayer (queue engine)
│  ├─ controller.ts       # now-playing buttons + search selection interactions
│  └─ lib/                # embeds, permissions, parsing, queue view
├─ db/                    # mongoose models + guild settings repository
├─ i18n/                  # t() + 6 locale files (en is source of truth)
├─ lib/                   # env (zod), web-env, api client, jwt, invite, catalog
└─ components/            # dashboard UI + shadcn-style primitives
tests/                    # vitest: i18n parity, filters, queue logic, parsing, nodes
```

## Architecture Notes

- **Split deployment**: the backend serves only `/api/*`, `/socket.io` and `/healthz`; everything else redirects to `DASHBOARD_URL`. The frontend is static-ish Next.js on Vercel with no secrets.
- **Optional dashboard**: `DASHBOARD_ENABLED=false` disables the API + socket server entirely and removes dashboard links from bot embeds; OAuth secrets are not validated in that mode.
- **Node failover**: Shoukaku load-balances across the main + backup nodes by penalties and moves active players on disconnect; all raw REST calls (lyrics, loadsearch) follow the current ideal node.
- **Real-time**: every player state change emits a snapshot on the bot event bus → socket.io room `guild:{guildId}` → dashboard. Socket connections are authenticated with the JWT session cookie and authorized against guild membership/DJ rules.
- **Cross-origin auth**: session cookie lives on the backend domain (`SameSite=None; Secure` in production, `Lax` in dev) and is sent with credentialed fetches/socket connections from the Vercel origin; CORS only allows `DASHBOARD_URL` and the dev origins.
- **Resilience**: MongoDB and Discord gateway connect with background retry; Lavalink sessions resume after restarts.
- **i18n**: all bot responses and dashboard strings come from `src/i18n/locales/*.json`; a Vitest test enforces key parity across the 6 locales.
