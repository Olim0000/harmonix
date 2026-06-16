# harmonix
Vibecoded test project DO NOT TRUST. private selfhosted music streaming app.

Multi-server remote playback: browse your music library from a source server, route audio to any registered player server (or play in-browser).

## Stack

- **Backend**: Express.js + SQLite3 + JWT auth (bcryptjs)
- **Frontend**: React 18 + Vite 5 + Zustand + react-router-dom + Axios + Feather icons
- **Audio**: ffplay (server-side), HTTP range streaming (browser), `<audio>` element

## Quick start

```bash
# backend (source + player servers)
cd backend && node server.js

# frontend (needs backend on :3001)
cd frontend && npm run dev

# metadata enrichment
node enrich-music.js
```

## Architecture

**Source server** — has music files + DB, serves library API + streaming. One per deployment.

**Player servers** — receive stream URLs and play via ffplay on their speakers. Same backend, no music folder needed. Multiple can be registered.

**Frontend** — always loads library from the source server. Playback routes to the selected player server (or browser speakers). Server selector in the player bar.

## Features

- Artist/album/track browsing with album art (iTunes → Deezer → Cover Art Archive)
- Artist bios & images from Wikipedia — run `node enrich-music.js` to fetch automatically
- Playlists (create, add/remove tracks, duplicate detection)
- Search with album cards + track results
- Admin panel: user management, DB enrichment with live log
- Multi-server playback: register any number of player servers, select from the player bar
- ffplay singleton on each server with play/pause/seek/volume
- Shuffle/repeat modes, volume control, progress bar with seek
- Dark theme, Feather icons, monochrome minimal aesthetic
- Full-screen now-playing overlay — tap the button for big view with progress, controls, and volume
- Keyboard shortcuts — Space=play/pause, ←→=seek, N/P=next/prev, M=mute, Escape=close fullscreen (seek curently bugged)
- Shuffle/repeat mutual exclusion — enabling one disables the other
- Mobile responsive — sidebar slide-out drawer, compact player, adaptive cards/tables on phones

## Permissions

| Role | Can |
|---|---|
| Admin | Browse library, play in-browser, use Main Server (ffplay on source machine), add/manage servers |
| Regular user | Browse library, play in-browser, register own player servers, use own servers |

## Env configuration

All in `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `supersecretkey123` | Shared across all servers for cross-server auth |
| `MUSIC_DIR` | `./music` | Relative to project root |
| `DB_PATH` | `./harmonix.db` | Relative to `backend/` |
| `PORT` | `3001` | Backend listen port |

## Requirements

- Node.js 18+
- ffmpeg (for ffplay) on all player servers
- PulseAudio (pactl) or ALSA (amixer) for volume control
