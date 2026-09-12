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

## Architecture (Vercel proxy split)

```
┌────────────────────────────┐         ┌─────────────────────────────┐
│  VERCEL (frontend + proxy) │  proxy  │  BACKEND (Wispbyte/any Node)│
│  - Next.js dashboard       │ ──────► │  - Discord bot              │
│  - vercel.json rewrites:   │  HTTP + │  - REST API  /api/*         │
│      /api/*  ──────────────┼─WS────► │  - socket.io /socket.io/*  │
│      /socket.io/* ─────────┘         │  - MongoDB                  │
└────────────────────────────┘         └─────────────────────────────┘
        browser talks ONLY to the Vercel HTTPS domain
```

`vercel.json` rewrites make Vercel a **reverse proxy**: every `/api/*` and `/socket.io/*` request (including websockets) is forwarded to the backend's address. Everything is same-origin from the browser's perspective — no cross-origin cookies, no CORS pain, and the backend doesn't even need HTTPS (Vercel ↔ backend is server-to-server over plain HTTP; the browser always sees Vercel's HTTPS).

The backend (`server.ts` → `dist/server.js`) runs the bot, the REST API and the socket server. The dashboard is **optional**: `DASHBOARD_ENABLED=false` runs a pure bot with no web surface at all.

| Layer | Tech |
|---|---|
| Bot + API | discord.js v14 + Shoukaku 4 + raw Node HTTP + socket.io |
| Audio | 3rd-party Lavalink v4 nodes (LavaSrc, LavaSearch, LavaLyrics plugins) |
| Dashboard | Next.js 15 (App Router) on Vercel + vercel.json rewrites |
| Database | MongoDB (Atlas) + Mongoose |
| Auth | Discord OAuth2 on the backend → JWT (jose) httpOnly cookie (same-origin via proxy) |

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

## Deployment (Wispbyte backend + Vercel frontend)

### 1. Backend on Wispbyte (or any Node 20+ host)

Panels that run `node /home/container/${JS_FILE}` can't run TypeScript — build locally, upload the bundle:

1. On your machine:
   ```powershell
   pnpm install
   pnpm build:server     # → dist/server.js
   ```
2. Upload `dist/` (plus `package.json`, and your `.env`) to the container; set `JS_FILE=dist/server.js`, `AUTO_UPDATE=0`, `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=<allocated port>`, and use a Node 20+ image.
3. Let the panel's `npm install` finish (retry if OOM-killed; delete a partially killed `node_modules` and retry — the runtime needs only the production dependencies).
4. Backend env (see `.env.example`): `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `MONGODB_URI` (Atlas), `LAVALINK_*`, and:
   - `APP_URL=https://<your-vercel-url>` — the **public** URL browsers use (Vercel proxies to the backend)
   - `DASHBOARD_ENABLED=false` — optional: run a pure bot; no API/socket/dashboard links, OAuth secrets unnecessary

The container's `IP:PORT` allocation is what Vercel will proxy to.

### 2. Frontend on Vercel

1. Import the repo as a Vercel project — **Root Directory `./`** (repo root), Next.js auto-detected, `pnpm build` runs automatically.
2. **Edit `vercel.json`** in the repo: replace `YOUR-WISPBYTE-ADDRESS:PORT` in both rewrites with your backend's public address (e.g. `http://212.227.166.131:10857`):
   ```json
   {
     "rewrites": [
       { "source": "/api/(.*)", "destination": "http://YOUR-BACKEND/api/$1" },
       { "source": "/socket.io/(.*)", "destination": "http://YOUR-BACKEND/socket.io/$1" }
     ]
   }
   ```
3. Vercel env vars: `NEXT_PUBLIC_DISCORD_CLIENT_ID` only. **Leave `NEXT_PUBLIC_API_URL` unset** — the rewrites keep everything same-origin.
4. Deploy → note the URL (e.g. `https://slux.vercel.app`), then set it as `APP_URL` on the backend (redeploy/restart the backend after).

### 3. Discord OAuth setup

On the Developer Portal → OAuth2, add the redirect:

```
https://<your-vercel-url>/api/auth/callback
```

Login flow: Login button → same-origin `/api/auth/login` → Vercel proxies to backend → Discord → callback proxied back → session cookie set (same-origin Lax cookie) → redirect to `/dashboard`.

### Alternative: single host (no Vercel)

Any Node host can also run everything together (Railway/Render/VPS): `pnpm build:all`, `node dist/server.js`, `APP_URL=<that host's URL>`. Non-API requests then redirect to `DASHBOARD_URL` — or serve your own frontend build there. For direct frontend-on-another-domain setups, set `NEXT_PUBLIC_API_URL` (cross-origin cookies then require `SameSite=None`, which this build no longer emits — prefer the proxy pattern).

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
- **Dashboard shows errors / no data**: check the `vercel.json` rewrites point at the right backend address (test `https://<vercel-url>/api/stats` in your browser — should return JSON), and that the backend is running (`/healthz` on its direct address).
- **Login loops / "unauthorized"**: the OAuth redirect on the portal must exactly equal `https://<vercel-url>/api/auth/callback`, and the backend's `APP_URL` must equal the Vercel URL.
- **Realtime not updating**: websockets proxied through Vercel rewrites need the `/socket.io/(.*)` rewrite present; check the browser console for connection errors.
- **YouTube "Sign in to confirm you're not a bot"**: the node's provider may be rate-limited — ask your provider or switch nodes. Other sources are unaffected.

## Project Structure

```
server.ts                 # backend entry: HTTP + API + socket.io + bot
vercel.json               # Vercel rewrites: /api/* + /socket.io/* → backend
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

- **Vercel proxy split**: `vercel.json` rewrites forward `/api/*` and `/socket.io/*` (websockets included) to the backend, so the browser only ever talks to the Vercel HTTPS domain — same-origin cookies and sockets, no CORS complexity, backend can be plain HTTP.
- **Optional dashboard**: `DASHBOARD_ENABLED=false` disables the API + socket server entirely and removes dashboard links from bot embeds; OAuth secrets are not validated in that mode.
- **Node failover**: Shoukaku load-balances across the main + backup nodes by penalties and moves active players on disconnect; all raw REST calls (lyrics, loadsearch) follow the current ideal node.
- **Real-time**: every player state change emits a snapshot on the bot event bus → socket.io room `guild:{guildId}` → dashboard. Socket connections are authenticated with the JWT session cookie and authorized against guild membership/DJ rules.
- **Resilience**: MongoDB and Discord gateway connect with background retry; Lavalink sessions resume after restarts.
- **i18n**: all bot responses and dashboard strings come from `src/i18n/locales/*.json`; a Vitest test enforces key parity across the 6 locales.
