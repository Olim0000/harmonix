# Harmonix

Self-hosted private music streaming server with multi-device ffplay playback.

## Prerequisites

- Node.js >= 22
- npm
- ffplay (ffmpeg with SDL support)
- SQLite

## Quick Start

```bash
git clone <repo-url> && cd harmonix
npm install
cp .env.example .env    # edit JWT_SECRET and MUSIC_DIR
npm run dev              # starts backend:3001 + frontend:5173

# Production
npm run build
npm start                # serves built backend on PORT
```

## Configuration

All configuration is via environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server listen port |
| `MUSIC_DIR` | *(required)* | Path to music library (scanned by admin scan job) |
| `DB_PATH` | `./data/harmonix.db` | SQLite database file path |
| `COVERS_DIR` | `./data/covers` | Directory for extracted cover art |
| `JWT_SECRET` | *(required)* | Random secret for JWT signing (min 32 chars, not in deny-list) |
| `ROLE` | `source` | Server role: `source` (library + API) or `player` (playback only) |
| `SOURCE_URL` | *(optional)* | URL of the source server (required for player-role servers) |
| `FFPLAY_PATH` | `ffplay` | Path to ffplay binary |

Generate a secure JWT_SECRET:

```bash
openssl rand -base64 32
```

## Architecture

- **Backend**: Hono + better-sqlite3, REST API with JWT auth
- **Frontend**: React + Vite SPA
- **Playback**: ffplay subprocess (spawned per track, stdin for pause/resume)
- **Search**: SQLite FTS5 full-text search
- **Real-time**: SSE for scan progress streaming
- **Multi-server**: source role serves library; player role connects to a remote source

## Installing ffplay

ffplay is part of ffmpeg. Install ffmpeg with SDL support:

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

Verify installation:

```bash
ffplay -version
```

> **Note**: ffplay requires SDL for video output. On headless servers, ffplay works
> in audio-only mode with `-nodisp`. If ffplay is missing, the server still starts
> but playback endpoints return an error.

## Admin Account

A default admin account is created on first run:

- **Username**: `admin`
- **Password**: `admin`

Change the password after first login. Admin access is required for library scanning.

## Multi-Server Setup

Harmonix supports a **source/player** architecture:

1. **Source server** (`ROLE=source`): Hosts the music library, runs scans, serves the API
2. **Player server** (`ROLE=player`): Connects to a remote source, handles playback only

To set up a player server:

```bash
# On the player machine
ROLE=player
SOURCE_URL=http://<source-ip>:3001
JWT_SECRET=<same-secret-as-source>
PORT=3001
```

The frontend discovers servers automatically via `/api/source/info`. Add servers
in the UI Settings to switch between them.

## API Overview

| Endpoint Group | Path Prefix | Auth | Description |
|---------------|-------------|------|-------------|
| Auth | `/api/auth/*` | None | Register, login, token refresh |
| User | `/api/me` | JWT | Current user info |
| Library | `/api/artists`, `/api/albums`, `/api/tracks` | JWT | Browse music library |
| Search | `/api/search?q=` | JWT | Full-text search across library |
| Player | `/api/player/*` | JWT | Playback control (play/pause/stop/seek/volume) |
| Likes | `/api/likes` | JWT | Like/unlike tracks, artists, albums |
| Playlists | `/api/playlists` | JWT | CRUD playlists with track ordering |
| Servers | `/api/servers` | JWT | Manage remote server connections |
| Covers | `/api/covers/*` | None | Album cover art images |
| Stream | `/api/stream/*` | None | Audio streaming for playback |
| Scan | `/api/admin/scan` | JWT+Admin | Trigger library scan, SSE progress |
| Source Info | `/api/source/info` | None | Server role and capabilities |
| Health | `/api/health` | None | Health check |

## Development

```bash
npm run dev       # start dev servers (backend + frontend)
npm test          # run all workspace tests
npm run build     # TypeScript type-check all workspaces
npm run lint      # lint all workspaces
npm run smoke     # run smoke tests (requires running server)
```

Smoke tests (`npm run smoke`) hit a live server on localhost:3001 and verify all
API surfaces end-to-end.

## License

MIT
