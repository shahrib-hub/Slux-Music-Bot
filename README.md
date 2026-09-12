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

## Stack

| Layer | Tech |
|---|---|
| Bot | discord.js v14 + Shoukaku 4 (custom queue/player engine) |
| Audio | 3rd-party Lavalink v4 nodes (LavaSrc, LavaSearch, LavaLyrics, youtube-source plugins) |
| Dashboard | Next.js 15 (App Router) served from a custom Node server + socket.io |
| Database | MongoDB (Atlas on hosting) + Mongoose |
| Auth | Discord OAuth2 + JWT (jose) httpOnly cookie sessions |

## Development

Prerequisites: Node.js ≥ 20, pnpm ≥ 9.

```powershell
# 1. Install dependencies
pnpm install

# 2. Configure
Copy-Item .env.example .env   # fill in the required values

# 3. Run (esbuild watch + node watch + Next dev)
pnpm dev
```

> Note: Windows PowerShell 5.1 does not support `&&` between commands — run each command on its own line (as shown) or use `;`.

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

## Hosting (bot + dashboard together)

The bot and dashboard run as **one Node process**, so any Node.js host works (Railway, Render, Fly.io, a VPS…). No Docker needed.

1. **Push the repo** to your host (or point it at your git remote).
2. **Set the environment variables** (see `.env.example`): all the `DISCORD_*` keys, `SESSION_SECRET`, `APP_URL`, `MONGODB_URI` (MongoDB Atlas `mongodb+srv://…` works great), and the `LAVALINK_*` block above.
3. **Build & start**:

   ```bash
   pnpm install
   pnpm build
   pnpm start
   ```

4. On the Discord Developer Portal, set the OAuth2 redirect URI to `${APP_URL}/api/auth/callback` — `APP_URL` must be your public URL (e.g. `https://your-app.up.railway.app`).

Notes:

- The server binds to `HOST` (default `0.0.0.0`) and respects `PORT` — both are what platforms like Railway/Render expect.
- Session cookies are `secure` automatically in production, so HTTPS works out of the box behind platform TLS termination.
- Slash commands register on startup; prefix commands need the **Message Content Intent** enabled on the portal.

### Game-panel hosting (Pterodactyl-style: `npm install` + `node JS_FILE` startup)

Panels that run `node /home/container/${JS_FILE}` **cannot start `server.ts`** — Node doesn't run TypeScript. The runtime needs the **prebuilt bundle**:

1. **On your machine:** build and upload the artifacts.
   ```powershell
   pnpm install
   pnpm build        # produces dist/server.js + .next/
   ```
   Upload `dist/` and `.next/` (plus your `.env`) to the container so they sit directly in `/home/container`.
2. **Panel Startup tab:** set the main file / `JS_FILE` variable to `dist/server.js`, and set `AUTO_UPDATE=0` (build output isn't in git).
3. **Dependencies:** let the panel's `npm install` finish (retry if it gets `Killed` on small containers — a partially killed install should be deleted and retried). The runtime needs the production dependencies from `package.json`; TypeScript/esbuild/Next never run on the server. If the full install OOMs, build `node_modules` in a Linux environment with `npm install --omit=dev --no-audit --no-fund` and upload that folder instead (Windows-built `node_modules` won't work — Next's SWC binaries are platform-specific).
4. **Environment:** `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=` the port the panel allocated. Use a **Node 20+** image (required).

Rebuild and re-upload after every code change (`pnpm build`).

## Discord Application Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** page: create the bot, copy the token into `DISCORD_TOKEN`, and enable the **Message Content Intent** (privileged intent, required for prefix commands).
3. **OAuth2** page: copy Client ID/Secret into `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, and add a redirect URI: `${APP_URL}/api/auth/callback` (e.g. `http://localhost:3000/api/auth/callback`).
4. Generate a session secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
5. Invite the bot with the link shown on the dashboard guild picker (or `/invite` in Discord). Required permissions: View Channels, Send Messages, Embed Links, Read Message History, Use External Emojis, Manage Messages, Connect, Speak, **Set Voice Channel Status** (for the live "now playing" channel status — if the bot was invited before this feature, grant the permission to the bot's role in Server Settings or re-invite with the new link).

## Environment Variables

See `.env.example`. Required: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` (32+ chars), `MONGODB_URI`, and the `LAVALINK_*` block for your main node (plus the optional `LAVALINK_BACKUP_*` block for failover). Optional: `HOST`/`PORT` (defaults `0.0.0.0`/`3000`) and `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` for native Spotify resolution via LavaSrc.

## Usage

- **Slash commands**: `/play never gonna give you up`
- **Prefix commands**: `!play <query>` (mention also works as prefix; change with `/prefix`)
- **Mention the bot** (`@Slux`) anywhere for a quick-start card with this server's prefix and popular commands.
- **Dashboard**: login with Discord → pick a server → control the player, edit settings, manage playlists from your browser.

Try: `!play <song>`, `!search <query>` (button picker), `!lyrics`, `!bassboost insane`, `!autoplay`, `!247`, `!sleep 30`, `!skipto 3`, `!removeduplicates`, `!playlist save chill`, `!favorites add`, `!nodes`.

## Troubleshooting

- **Bot never connects to Lavalink**: verify host/port/password with your provider, and that `LAVALINK_SECURE=true` is set for TLS nodes (false for plain ones). Run `/nodes` to see live node status.
- **YouTube "Sign in to confirm you're not a bot"**: the node's provider may be rate-limited by YouTube — ask your provider or switch to a node with cleaner IPs. Deezer/SoundCloud/other sources are unaffected.
- **OAuth redirect URI mismatch**: the portal redirect must exactly equal `${APP_URL}/api/auth/callback`.
- **Searches return nothing**: the node must run LavaSearch/LavaSrc plugins — confirm with your provider (or `/nodes` + provider docs).

## Project Structure

```
server.ts                 # custom server: HTTP + socket.io + bot + Next
scripts/dev.mjs           # esbuild watch + node watch dev runner
src/
├─ app/                   # Next.js App Router (marketing + dashboard + API routes)
├─ bot/
│  ├─ bot.ts              # BotService: client, Shoukaku, handlers, slash registration
│  ├─ commands/           # 62 commands across music/playlists/filters/settings/info
│  ├─ music/              # MusicManager (search/resolve/lyrics) + GuildPlayer (queue engine)
│  ├─ controller.ts       # now-playing buttons + search selection interactions
│  └─ lib/                # embeds, permissions, parsing, queue view
├─ db/                    # mongoose models + guild settings repository
├─ i18n/                  # t() + 6 locale files (en is source of truth)
├─ lib/                   # env (zod), lavalink nodes, jwt/auth, bot singleton, catalog
└─ components/            # dashboard UI + shadcn-style primitives
tests/                    # vitest: i18n parity, filters, queue logic, parsing, nodes
```

## Architecture Notes

- **One process**: bot, dashboard, and socket.io share a Node process. The `BotService` singleton lives on `globalThis` so Next dev-mode module reloads never create duplicate bots.
- **Node failover**: Shoukaku load-balances across the main + backup nodes by penalties and moves active players on disconnect; all raw REST calls (lyrics, loadsearch) follow the current ideal node.
- **Real-time**: every player state change emits a snapshot on the bot event bus → socket.io room `guild:{guildId}` → dashboard. Socket actions are authenticated with the JWT session cookie and authorized against guild membership/DJ rules.
- **Resilience**: MongoDB and Discord gateway connect with background retry; Lavalink sessions resume after restarts.
- **i18n**: all bot responses and dashboard strings come from `src/i18n/locales/*.json`; a Vitest test enforces key parity across the 6 locales.
