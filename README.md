# Nifty Dashboard

A Spotify-style web control room for the [Nifty](../Nifty) Discord music bot.

It is a **pure add-on**. The dashboard owns **no database** — every Nifty bot
is the single source of truth and pushes its state over a WebSocket. If the
dashboard is offline or crashes, the bot(s) keep playing untouched; if the bot
is offline, the dashboard simply shows an empty state.

## Features

- 🎛️ Spotify-style layout: black top bar (logo, search, server/voice selector,
  account), left library, center content, right queue / now-playing, bottom player.
- ↔️ **Wide and compact** player formats (a setting).
- 🎨 **On-the-fly themes** (Nifty / Spotify / Amethyst / Crimson / Light) via
  Tailwind CSS variables.
- 🤖 **Multi-bot, multi-guild**: several Nifty instances can connect at once. The
  selector shows each server, its voice channel and which bot serves it; actions
  route back to the owning bot.
- 🔍 Fast YouTube Music search (no API key of your own) → add straight to a queue.
- 🔐 Discord OAuth2 → stateless **JWT session cookie**. No database, no token table.
- 🖼️ Track artwork with a graceful fallback image.

## Architecture

```
[ Browser ] --HTTPS/WSS--> [ Nifty Dashboard (this app) ] <--WSS-- [ Nifty bot(s) ]
   JWT cookie session            ws hub + relay, no DB           private SQLite, truth
```

The dashboard relays two peer types on `/ws`:

- **bots** identify with the shared `DASHBOARD_TOKEN`;
- **browsers** are authenticated automatically from their httpOnly session cookie
  (the JWT is never exposed to client JS).

### Protocol (summary)

| Op | Direction | Purpose |
|----|-----------|---------|
| `hello` / `heartbeat` / `heartbeat_ack` | both | handshake + keepalive |
| `identify` / `identify_success` / `identify_error` | peer → hub | auth |
| `sessions_request` | browser → hub → bots | "which servers can I control?" |
| `sessions` | bot → hub → browser | per-user servers + voice channel + now playing |
| `subscribe` | browser → hub → owning bot | start receiving a guild's player/queue |
| `player` / `queue` | bot → hub → browser | live state (full queue inline) |
| `action` | browser → hub → owning bot | togglePause/skip/back/loop/shuffle/volume/seek/jump/play/remove/clear |

## Setup

1. `cp .env.example .env` and fill it in:
   - **Discord**: create an app at <https://discord.com/developers/applications>,
     add a redirect of `https://your-host/login`, and set
     `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`.
   - **`DASHBOARD_JWT_SECRET`**: a long random string.
   - **`DASHBOARD_TOKEN`**: a long random string; set the *same* value in each
     bot's `.env`.
2. Point each bot at this dashboard by setting in the bot's `.env`:
   ```
   DASHBOARD_WS_URL=wss://your-host/ws
   DASHBOARD_TOKEN=<same as above>
   DASHBOARD_BOT_NAME=Nifty
   ```

## Run

```bash
npm install
npm run dev      # development (http://localhost:3000)

npm run build    # production build
npm run start    # production server
```

### Docker

```bash
docker build -t nifty-dashboard .
docker run -p 3000:3000 --env-file .env nifty-dashboard
```

Terminate TLS (and upgrade `/ws` to `wss`) at a reverse proxy (nginx/Caddy) in
front of the container.

## Notes

- Search returns songs, videos and playlists (resolved with no extra requests,
  so it stays fast). Albums/artists are intentionally skipped.
- The dashboard never blocks the bot. All bot-side sends are guarded no-ops when
  the socket is down.
