# Harmonix — Agent Guide

Self-hosted private music streaming app with multi-server remote playback. Express.js backend + React/Vite frontend.

## Architecture

Two packages at root, no monorepo tool:
- `backend/` — Express server on port 3001, SQLite3 (`harmonix.db`), JWT auth (bcryptjs)
- `frontend/` — React 18 + Vite 5 + Zustand + react-router-dom + Axios
- `music/` — audio files in folders: `Artist - Album (Year)/NN - Title.ext`
- `enrich-music.js` — standalone Node script for metadata enrichment

**Multi-server model:** One source server has the music library + DB. Player servers run the same backend but only handle playback commands (no music scan needed). Frontend always loads library from source server; playback commands route to the selected player server.

## Commands

```
# backend
cd backend && node server.js

# frontend (needs backend running on :3001)
cd frontend && npm run dev

# metadata enrichment (one-time or after adding music)
node enrich-music.js
```

## Key conventions

- `enrich-music.js` — fetches artist bios + images from Wikipedia API (`enrich-music.js:120-122`). Idempotent (skips artists with bio already set). Run after adding music.
- Backend auto-scans `music/` and seeds the SQLite DB on every startup (`db.js:247-265`)
- No Vite proxy; frontend API base is hardcoded to `http://localhost:3001/api` (`api/client.js:4`)
- JWT secret in `backend/.env` (default `supersecretkey123`)
- No tests, no lint, no typecheck, no CI — purely a dev project
- Audio streaming uses HTTP range requests (`tracks.js:59-76`)
- **Player module** (`backend/player.js:1-122`): ffplay singleton with play/pause(SIGSTOP)/resume(SIGCONT)/stop/seek(kill+restart with `-ss`)/setVolume(pactl fallback amixer). State tracked in-memory (lost on restart). Position tracked via 1s `setInterval`.
- **Player API** (`backend/routes/player.js`): 7 endpoints, all JWT-protected (`authenticateToken`). Stream endpoint (`tracks.js:52`) has no auth — ffplay can fetch from source server without headers.
- **Servers** are per-user (`servers.user_id`). CRUD scoped to `req.user.id`. No admin-only restriction on the API itself — each user manages their own servers.
- **Native Main Server** (localhost:3001) is frontend-only for admin: prepended as `id:0, builtin:true` in Servers page + Player dropdown. Not stored in DB. No delete button. Regular users don't see it.
- **Player component** (`Player.jsx`): three modes — Browser (`<audio>` element, local speakers), Main Server (ffplay on source machine, admin only), Remote Server (ffplay on remote machine). Server selector dropdown in `player-right`. 2s polling for remote status. Full-screen now-playing overlay (tap track info to open, Escape/close button to dismiss) with big album art, progress bar, controls, and volume. Keyboard shortcuts: Space=play/pause, ←→=seek ±5s, N=next, P=previous, M=mute, Escape=close fullscreen.
- **Mobile responsive** — `global.css` has `@media (max-width: 768px)` breakpoint. Sidebar becomes slide-out drawer (`translateX(-100%)` → `translateX(0)`, overlay, hamburger toggle). `.hide-mobile` class hides volume/server controls on compact player. Card grids tighten to `minmax(100px, 1fr)`. Servers table hides Port + Status columns. Content gets `padding-left: 48px` to clear the toggle button.

## Database tables

### `servers` (added by agent)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `user_id` INTEGER NOT NULL — FK to `users.id` (per-user scoping)
- `name` TEXT NOT NULL
- `host` TEXT NOT NULL
- `port` INTEGER NOT NULL DEFAULT 3001
- `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP

## Layout

Every page shell: `<Sidebar /> | <main>content</main> | <Player />` (fixed bottom bar).

## Relevant files

- `backend/player.js` — ffplay singleton, position tracking, EventEmitter for `trackEnd`
- `backend/routes/player.js` — play/pause/resume/stop/seek/volume/status endpoints
- `backend/routes/servers.js` — per-user server CRUD (GET/POST/DELETE)
- `frontend/src/api/player.js` — `fetch`-based helper to send commands to `http://{host}:{port}/api/player/*`
- `frontend/src/components/Player.jsx` — three-mode player: Browser / Main Server / Remote Server; full-screen now-playing overlay; keyboard shortcuts; time-based seek guard (500ms); server debounce (300ms)
- `frontend/src/pages/Servers.jsx` — server management with Back to Home link, Test button, native Main Server for admin
- `frontend/src/store/playerStore.js` — `activeServer` + `remoteStatus` state; shuffle/repeat mutually exclusive
- `frontend/src/components/Sidebar.jsx` — hamburger toggle, `menuOpen` state, overlay, `open` class for drawer transform, close-on-nav
- `frontend/src/styles/global.css` — responsive breakpoints, `.hide-mobile` utility class, theme CSS variables, mobile player/cards/tables styles
- `enrich-music.js` — standalone Node script for Wikipedia API enrichment (artist bios + images)

## Potential gotchas

- Playlist tracks migration in `db.js:217-245` — if DB has column named `track Id` (with space), it gets auto-fixed
- If backend can't find music, check `MUSIC_DIR` in `.env` (default `./music` from project root)
- Frontend token stored in `localStorage` keys `token` and `username`
- Player state is **in-memory only** — lost on server restart. Frontend detects this when polling returns connection error.
- **ffplay** must be installed on all player servers (`apt install ffmpeg`). Uses SIGSTOP/SIGCONT for pause/resume, SIGTERM for stop, `-ss` for seek.
- Volume uses `pactl` (PulseAudio) with fallback to `amixer` (ALSA). Ensure at least one is available on player servers.
- Native Main Server (id=0, builtin) is a frontend construct — not in the DB. `stopOnServer()` and other player API calls work the same way for it (local ffplay on port 3001).
- JWT is shared via `JWT_SECRET` across all servers. `authenticateToken` only verifies the signature (no DB query), so player servers can validate tokens without having users in their DB.
- `enrich-music.js` needs internet access (Wikipedia API). Rate-limited by Wikipedia's terms.
- On mobile (<768px), `.content` uses `padding-left: 48px` to keep page titles from being hidden behind the fixed hamburger toggle.
