# Harmonix — Agent Guide

Self-hosted private music streaming app with multi-server remote playback. Express.js backend + React/Vite frontend.

## Architecture

Two packages at root, no monorepo tool:
- `backend/` — Express server on port 3001, SQLite3 (`harmonix.db`), JWT auth (bcryptjs)
- `frontend/` — React 18 + Vite 5 + react-router-dom (no external state libs)
- `music/` — audio files in folders: `Artist - Album (Year)/NN - Title.ext`

**Multi-server model:** One source server has the music library + DB. Player servers run the same backend but only handle playback commands (no music scan needed). Frontend always loads library from source server; playback commands route to the selected player server.

## Commands

```
cd backend && node server.js
cd frontend && npm run dev
```

## Key conventions

- Backend auto-scans `music/` and seeds the SQLite DB on every startup (`db.js:226-261`)
- No Vite proxy; frontend API base is hardcoded to `http://localhost:3001/api` (`api/client.js`)
- JWT secret in `backend/.env` (default `supersecretkey123`)
- Audio streaming uses HTTP range requests (`tracks.js:59-76`)
- **Player module** (`backend/player.js`): ffplay singleton with play/pause(SIGSTOP)/resume(SIGCONT)/stop/seek(kill+restart with `-ss`)/setVolume(pactl fallback amixer). State tracked via 1s `setInterval`.
- **Player API** (`backend/routes/player.js`): 7 endpoints, all JWT-protected (`authenticateToken`). Stream endpoint (`tracks.js:52`) has no auth — ffplay can fetch from source server without headers.
- **Enrichment module** (`backend/enricher.js`): async Wikipedia + Deezer enrichment. Artist bios/images from Wikipedia REST API, album covers from Deezer search API. Images downloaded to `frontend/public/covers/`. Admin-triggered via `POST /api/admin/enrich` with `mode: full|partial`.
- **Likes system**: click heart on TrackRow, ArtistPage, AlbumPage. Stored in `likes` table `(user_id, item_type, item_id)`. Module-level cache avoids redundant API calls. "Liked" page at `/liked` shows all three types.
- **Servers** are per-user (`servers.user_id`). CRUD scoped to `req.user.id`. No admin-only restriction on the API itself — each user manages their own servers.
- **Native Main Server** (localhost:3001) is frontend-only for admin: prepended as `id:0, builtin:true` in Servers page + Player dropdown. Not stored in DB. No delete button. Regular users don't see it.
- **Player component** (`Player.jsx`): three modes — Browser (`<audio>` element), Main Server (ffplay, admin only), Remote Server (ffplay). 2s polling for remote status. Full-screen overlay with controls + progress. Keyboard shortcuts: Space=play/pause, ←→=seek ±5s, N=next, P=previous, M=mute, Escape=close fullscreen.
- **Mobile responsive** — `global.css` has `@media (max-width: 768px)` breakpoint. Sidebar becomes slide-out drawer. `.hide-mobile` utility class. Servers table hides Port + Status columns on mobile.

## State management

- `AuthContext` (store/AuthContext.jsx) — React Context + useState for user auth state
- `PlayerContext` (store/PlayerContext.jsx) — React Context + useReducer for player state. Queue, volume, shuffle, repeat, activeServer persisted to `localStorage` across refresh.
- Token stored in `localStorage` keys `token` and `username`

## Database tables

### `servers`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `user_id` INTEGER NOT NULL — FK to `users.id` (per-user scoping)
- `name` TEXT NOT NULL
- `host` TEXT NOT NULL
- `port` INTEGER NOT NULL DEFAULT 3001
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

### `likes`
- `user_id` TEXT NOT NULL
- `item_type` TEXT NOT NULL — `'track'`, `'artist'`, or `'album'`
- `item_id` TEXT NOT NULL — track/artist id as string, or `artistId:albumName` for albums
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
- `PRIMARY KEY (user_id, item_type, item_id)`

## Layout

Every page shell: `<PageLayout>` wraps `<Sidebar /> | <main>content</main> | <Player />` (fixed bottom bar).

## Relevant files

- `backend/player.js` — ffplay singleton, EventEmitter for `trackEnd`
- `backend/routes/player.js` — play/pause/resume/stop/seek/volume/status
- `backend/routes/servers.js` — per-user server CRUD
- `backend/routes/likes.js` — like/unlike API for tracks/artists/albums
- `backend/enricher.js` — Wikipedia + Deezer enrichment, async job with progress
- `frontend/src/api/player.js` — fetch-based helpers for remote player commands
- `frontend/src/components/Player.jsx` — three-mode player with fullscreen overlay
- `frontend/src/components/Sidebar.jsx` — hamburger toggle, drawer on mobile
- `frontend/src/components/PageLayout.jsx` — shared layout wrapper for all pages
- `frontend/src/styles/global.css` — responsive breakpoints, CSS variables
- `frontend/src/store/AuthContext.jsx` — auth state via React Context
- `frontend/src/store/PlayerContext.jsx` — player state via React Context

## Potential gotchas

- If backend can't find music, check `MUSIC_DIR` in `.env` (default `./music` from project root)
- Frontend token stored in `localStorage` keys `token` and `username`
- Player state is **in-memory only** — lost on server restart. Frontend detects this when polling returns connection error.
- **ffplay** must be installed on all player servers (`apt install ffmpeg`). Uses SIGSTOP/SIGCONT for pause/resume, SIGTERM for stop, `-ss` for seek.
- Volume uses `pactl` (PulseAudio) with fallback to `amixer` (ALSA). Ensure at least one is available on player servers.
- Native Main Server (id=0, builtin) is a frontend construct — not in the DB.
- JWT is shared via `JWT_SECRET` across all servers. `authenticateToken` only verifies the signature (no DB query), so player servers can validate tokens without having users in their DB.
- On mobile (<768px), `.content` uses `padding-left: 48px` to keep page titles from being hidden behind the fixed hamburger toggle.