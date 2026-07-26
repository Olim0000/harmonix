# Phase 1 MVP Slice Specification

> **Status: COMPLETE** — All 41 tasks delivered across sub-phases P1a, P1b, P1c0, P1c-1, P1c-2, P1d.
> 160 tests passing, smoke tests passing, build clean. See README.md for deployment instructions.

## 1. Phase 1 Task Breakdown
| ID | Title | Scope | Files | Deps | Acceptance (✓) | Validation |
|----|-------|-------|-------|------|----------------|------------|
| P1-T01 | Monorepo scaffold | small | root/package.json, root/start.sh, root/.gitignore, backend/, frontend/, docs/ | – | - [x] Repo contains backend/, frontend/, docs<br>- [x] `npm install` succeeds<br>- [x] `npm run dev` starts both services | `npm install && npm run dev` shows ready logs |
| P1-T02 | DB schema & admin seed | small | data/harmonix.db, backend/src/db.ts | P1-T01 | - [x] SQLite DB created with WAL<br>- [x] All tables present<br>- [x] Admin user inserted; password logged | `sqlite3 data/harmonix.db ".schema"` lists tables |
| P1-T03 | Auth routes (register, login, me, refresh) | medium | backend/src/auth/* | P1-T02 | - [x] POST /api/auth/register returns JWT<br>- [x] POST /api/auth/login returns JWT<br>- [x] GET /api/me returns user info<br>- [x] POST /api/auth/refresh issues new token | `curl` checks return 200 + valid JWT |
| P1-T04 | JWT signature‑only verification helper | small | backend/src/jwt.ts | P1-T03 | - [x] Verifies JWT without DB<br>- [x] Invalid token → 401<br>- [x] Payload contains sub, role, exp, iat | Manual curl with bad token → 401 |
| P1-T05 | Library routes (artists, albums, tracks) | medium | backend/src/library/* | P1-T02 | - [x] GET /api/artists returns list<br>- [x] GET /api/artists/:id includes albums<br>- [x] GET /api/albums/:id includes tracks<br>- [x] GET /api/tracks/:id returns full object | `curl` validates JSON structure |
| P1-T06 | Search (FTS5) endpoint | small | backend/src/search.ts | P1-T02 | - [x] GET /api/search?q=… returns results<br>- [x] ≤30 items<br>- [x] 300 ms client debounce respected (mock) | `curl "http://localhost:3001/api/search?q=beatles"` |
| P1-T07 | HTTP range streaming | medium | backend/src/stream.ts | P1-T05 | - [x] `Range` header → `206` with correct `Content‑Range`<br>- [x] Invalid range → `416`<br>- [x] Correct `Content-Type` per extension | `curl -I` checks headers |
| P1-T08 | Cover art route | small | backend/src/covers.ts | P1-T05 | - [x] GET /api/covers/embedded/:id serves file from data/covers<br>- [x] Missing → 404 (or fallback SVG) | `curl -I` checks status |
| P1-T09 | Scan job + SSE progress | medium | backend/src/admin/scan.ts | P1-T01 | - [x] POST /api/admin/scan triggers background job<br>- [x] GET /api/admin/scan/stream returns SSE events with progress data | Manual curl to SSE endpoint, verify JSON |
| P1-T10 | Player ffplay wrapper | medium | backend/src/player/* | P1-T09 | - [x] Spawns ffplay with stdin `p` for pause<br>- [x] Seek via `-ss` after kill/restart<br>- [x] Volume via pactl/amixer<br>- [x] Graceful handling if ffplay missing | Integration test: send pause/resume, check logs |
| P1-T11 | Player server routing (JWT pass‑through) | small | backend/src/playerServer.ts | P1-T03, P1-T10 | - [x] Forwards POST /api/player/* with JWT in Authorization header<br>- [x] Returns 400 if ffplay unavailable | `curl -X POST` to player route |
| P1-T12 | Role detection (source vs player) | small | backend/src/role.ts, env config | P1-T01 | - [x] Startup logs source/player based on ROLE<br>- [x] `/api/source/info` returns correct payload per role | `curl` checks payload |
| P1-T13 | Frontend scaffold (Vite+React19) | medium | frontend/package.json, src/main.tsx, src/App.tsx | P1-T01 | - [x] `npm run dev` serves frontend<br>- [x] Shell layout matches DESIGN.md<br>- [x] Zustand stores initialise | Browser opens login page |
| P1-T14 | Admin UI (users, scan, enrich stub) | medium | frontend/src/pages/Admin.tsx | P1-T13 | - [x] Users tab lists users, allows role change/delete (self‑protect)<br>- [x] Scan tab shows button & SSE placeholder<br>- [x] Enrich tab shows “Phase 2 — coming soon” | Manual UI inspection |
| P1-T15 | Validation suite (smoke tests) | small | scripts/smoke.sh or npm scripts | P1-T01‑P1-T14 | - [x] `npm run smoke` runs series of curl checks for all API surfaces<br>- [x] Build succeeds (`npm run build`) | `npm run smoke` exits 0 on success |
| P1-T16 | Likes API – like/unlike/list per user (track/artist/album) | medium | backend/src/likes/* | P1-T02 | - [x] POST /api/likes toggle state<br>- [x] GET /api/likes returns user’s liked items<br>- [x] Composite uniqueness enforced (track/artist/album) | `curl` checks like toggle and list |
| P1-T17 | Playlists API – CRUD, duplicate‑detect | medium | backend/src/playlists/* | P1-T02 | - [x] POST /api/playlists creates<br>- [x] GET /api/playlists lists<br>- [x] GET /api/playlists/:id returns tracks<br>- [x] POST /api/playlists/:id/tracks adds with dup‑check<br>- [x] DELETE /api/playlists/:id/tracks removes<br>- [x] PUT reorder validates dup‑check | `curl` tests add duplicate blocked |
| P1-T18 | Servers API – per‑user CRUD | medium | backend/src/servers/* | P1-T02 | - [x] GET /api/servers lists user servers<br>- [x] POST /api/servers creates server<br>- [x] PUT /api/servers/:id updates<br>- [x] DELETE /api/servers/:id deletes (except Main Server) | `curl` verifies each operation |
| P1-T19 | CORS config – Access‑Control‑Allow‑Origin & OPTIONS for /api/player/* | small | backend/src/cors.ts | P1-T11 | - [x] Preflight OPTIONS returns 200<br>- [x] All responses include `Access-Control-Allow-Origin` matching origin<br>- [x] `Authorization` header passed through | `curl -X OPTIONS` checks header |
| P1-T20 | ffplay risk mitigation – PID tracking, graceful shutdown, status endpoint | small | backend/src/player/ffplayGuard.ts | P1-T10 | - [x] PID stored and exposed via `/api/player/status`<br>- [x] SIGINT/SIGTERM kills ffplay cleanly<br>- [x] Status reports `{ffplayAvailable: false}` when missing | `curl /api/player/status` checks JSON |
| P1-T21 | README.md – quick‑start, architecture, ffplay install, admin password, env | small | README.md | – | - [x] File exists at repository root<br>- [x] Contains sections: Prereqs, Run, ffplay install, Admin password, Env vars | Open file and verify sections |
| P1-T23 | Auth – Login page ( DESIGN.md §4.1 ) | small | frontend/src/pages/Auth/Login.tsx | P1-T03 | - [x] Form renders, validates, shows loading<br>- [x] Inline error on bad input<br>- [x] Toast on network error | Manual test login flow |
| P1-T24 | Auth – Register page ( DESIGN.md §4.2 ) | small | frontend/src/pages/Auth/Register.tsx | P1-T03 | - [x] Form renders, validates, shows loading<br>- [x] Inline error on bad input<br>- [x] Toast on network error | Manual test registration |
| P1-T25 | Home page ( DESIGN.md §4.3 ) | small | frontend/src/pages/Home.tsx | P1-T05 | - [x] Empty/loading/active states handled<br>- [x] Matches DESIGN mock | Visual inspection |
| P1-T26 | Library page ( DESIGN.md §4.4 ) | small | frontend/src/pages/Library.tsx | P1-T05 | - [x] Lists items, handles empty/loading/error states | Visual inspection |
| P1-T27 | Artists page ( DESIGN.md §4.5 ) | small | frontend/src/pages/Artists.tsx | P1-T05 | - [x] Lists artists, shows cover thumbnail, handles empty state | Visual inspection |
| P1-T28 | ArtistDetail page ( DESIGN.md §4.6 ) | small | frontend/src/pages/ArtistDetail.tsx | P1-T05 | - [x] Shows artist info, discography, handles loading/error | Visual inspection |
| P1-T29 | AlbumDetail page ( DESIGN.md §4.7 ) | small | frontend/src/pages/AlbumDetail.tsx | P1-T05 | - [x] Shows album, tracks, cover, handles states | Visual inspection |
| P1-T30 | Search page ( DESIGN.md §4.8 ) | small | frontend/src/pages/Search.tsx | P1-T06 | - [x] Search input, debounce 300 ms, shows results or empty state | Manual search test |
| P1-T31 | Liked page ( DESIGN.md §4.9 ) – tabbed Tracks/Artists/Albums | small | frontend/src/pages/Liked.tsx | P1-T16 | - [x] Tabs switch, heart icon reflects state from Likes API<br>- [x] Empty state handling | Visual + API check |
| P1-T32 | Playlists list/create page ( DESIGN.md §4.10 ) | small | frontend/src/pages/Playlists.tsx | P1-T17 | - [x] Lists user playlists, shows empty/loading states<br>- [x] Create button opens form | Visual inspection |
| P1-T33 | Playlist detail page ( DESIGN.md §4.11 ) – drag‑reorder, add/remove, dup‑detect | small | frontend/src/pages/PlaylistDetail.tsx | P1-T17, P1-T32 | - [x] Drag‑reorder works with lightweight DnD lib<br>- [x] Add track blocks duplicate, shows toast<br>- [x] Remove track works, delete playlist works | Manual interaction test |
| P1-T34 | Servers page UI ( DESIGN.md §4.13 ) | small | frontend/src/pages/Servers.tsx | P1-T18 | - [x] Lists user’s servers, shows status indicator (green/red/yellow)<br>- [x] Shows "Main Server" entry (id=0) non‑deletable<br>- [x] Polls every 30 s for reachability | Visual + polling test |
| P1-T35 | Persistent PlayerBar UI ( DESIGN.md §4.14 ) | small | frontend/src/components/PlayerBar.tsx | P1-T10, P1-T36 | - [x] Left/middle/right sections render<br>- [x] Server selector dropdown with status indicators<br>- [x] Progress bar, volume slider, queue button, fullscreen button<br>- [x] Mobile variant 64 px height | Visual inspection on desktop & mobile |
| P1-T36 | QueueDrawer UI ( DESIGN.md §4.15 ) | small | frontend/src/components/QueueDrawer.tsx | P1-T33, P1-T37 | - [x] Right drawer slides in, drag‑reorder supported<br>- [x] Shows “Play Next”, “Up Next” sections<br>- [x] Clear button empties queue, persists via localStorage<br>- [x] Empty state handling | Manual test |
| P1-T37 | FullscreenOverlay UI ( DESIGN.md §4.16 ) | small | frontend/src/components/FullscreenOverlay.tsx | P1-T35, P1-T38 | - [x] Full viewport with blurred background, large artwork (300×300 desktop, 200×200 mobile)<br>- [x] Controls bar, progress, volume, server selector at bottom<br>- [x] Escape / swipe‑down / X closes, swipe‑down on mobile | Visual test on both devices |
| P1-T38 | Server selector behavior ( DESIGN.md §5.1 ) | small | frontend/src/components/ServerSelector.tsx | P1-T34 | - [x] Switching updates active server, fires toast “Switched playback to {name}”<br>- [x] If target unreachable, toast error and retains current server<br>- [x] Fresh‑start on new reachable server | Manual switch test |
| P1-T39 | Shuffle/repeat mutual exclusion ( DESIGN.md §5.2 ) | small | frontend/src/components/PlayerControl.tsx | P1-T39 | - [x] Mode cycles `none` ↔ `shuffle` ↔ `repeat` ↔ `repeat-one`<br>- [x] Visual icon reflects mode per DESIGN | Visual verification |
| P1-T40 | Keyboard shortcuts ( DESIGN.md §5.3 ) | small | frontend/src/hooks/useShortcuts.ts | P1-T39, P1-T40 | - [x] Global keydown handler with input‑guard<br>- [x] Supports Space, ←→, N, P, M, Escape, F, Q, /, L<br>- [x] Prevents when typing in input fields | Test shortcuts in UI |
| P1-T41 | Mobile responsive pass ( DESIGN.md §6.4, §6.5 ) | small | frontend/src/** (all pages) | P1-T23‑P1-T40 | - [x] Layout adapts under 768 px<br>- [x] Sidebar drawer, compact PlayerBar, touch‑friendly taps<br>- [x] All pages tested at 375 px viewport | Responsive inspection |

## 2. Phase 1 Overall Acceptance Criteria (≤15)
- [x] repo builds and runs (`npm run dev`) with both services.  
- [x] SQLite DB created, WAL enabled, all tables present.  
- [x] Admin user created on first run; password logged.  
- [x] Auth issues 15‑min JWTs; refresh works.  
- [x] Library API returns artists/albums/tracks correctly.  
- [x] Search returns ≤30 results via FTS5.  
- [x] Range streaming respects `Range`, status codes, MIME types.  
- [x] Cover art served from `data/covers/` (or fallback).  
- [x] Scan can be triggered; SSE streams progress.  
- [x] ffplay wrapper handles pause, seek, volume, missing ffplay gracefully.  
- [x] Player server forwards commands with JWT; returns 400 if ffplay missing.  
- [x] Role detection correctly identifies source/player.  
- [x] Frontend layout matches DESIGN.md and stores initialise.  
- [x] Admin UI functions (users, scan button, enrich stub).  
- [x] End‑to‑end admin flow updates library after scan.  
- 

## 3. Validation Plan
1. `npm install` – installs dependencies.  
2. `npm run dev` – starts backend & frontend; verify logs.  
3. Auth tests via `curl` for register, login, me, refresh.  
4. `curl http://localhost:3001/api/search?q=test` – returns ≤30 items.  
5. Range test: `curl -I /api/stream/:id` with valid/invalid ranges → 206/416, correct headers.  
6. Cover test: `curl -I /api/covers/embedded/:id` → 200 or 404.  
7. Scan test: `curl -X POST /api/admin/scan` → 200; then SSE `curl` reads progress JSON.  
8. Player test: `curl -X POST /api/player/play` → 200 if ffplay present, 400 with error if missing.  
9. `npm run build` – production bundle compiles without errors.  
10. `npm run smoke` – executes all curl checks; exits 0 on success.  
- Additional validation: check CORS headers, role detection payload, mobile breakpoint rendering.  

## 4. Risks (ordered by severity)
1. **ffplay stdin `p` reliability** – may fail on some platforms; mitigation: verify version and fallback to kill/restart.  
2. **CORS & Authorization header** on cross‑origin player POSTs – misconfiguration blocks commands; mitigation: explicit `Access-Control-Allow-Headers`.  
3. **Concurrent SSE connections** – could exhaust resources; mitigation: throttle to ≤1 Hz, close idle.  
4. **`better-sqlite3` missing on player‑only servers** – startup crash; mitigation: runtime check with clear error.  
5. **Empty or missing `MUSIC_DIR`** – scan would block; mitigation: early graceful exit with log.  
6. **Cover‑art extraction slowdown** – may delay scan; mitigation: run in background worker, limit per scan.  

## 5. Open Decisions Deferred
- **Monorepo orchestration** – use npm workspaces vs a single `start.sh` script; choose based on CI simplicity.  
- **Password hashing library** – `bcryptjs` vs `@noble/hashes`/`@noble/ciphers`; either acceptable, pick one in implementation.  
- **Drag‑and‑drop library for queue reorder** – pick a lightweight solution (e.g., `dnd-kit`); decide in P1‑T15.  

## 6. Open Issues for Lead
- No conflicts with locked technical decisions. The only pending decision is the monorepo orchestration method (workspaces vs script).

## 7. Sub-phase grouping
| Sub-phase | Task IDs | Runnable Increment Description |
|-----------|----------|--------------------------------|
| P1a | P1-T01, P1-T02, P1-T03, P1-T04, P1-T05, P1-T06, P1-T07, P1-T08, P1-T19 | Backend API foundation: scaffold, DB, auth, library, search, streaming, covers, CORS |
| P1b | P1-T09, P1-T10, P1-T11, P1-T12, P1-T20 | Player subsystem: scan + SSE, ffplay wrapper, routing, role detection, CORS, risk mitigation |
| P1c | P1-T13, P1-T23, P1-T24, P1-T25, P1-T26, P1-T27, P1-T28, P1-T29, P1-T30, P1-T31, P1-T32, P1-T33, P1-T34, P1-T35, P1-T36, P1-T37, P1-T38, P1-T39, P1-T40, P1-T41 | Full frontend UI: auth pages, library brows, liked page, playlists, servers, player components, shortcuts, mobile, interactions |
| P1d | P1-T15, P1-T21 | Documentation, validation suite, final smoke tests, final risk mitigation |

## 8. Auto-forecast
- estimated_scope: large
- affected_files: (backend/src/* for API tasks, backend/src/player/*, backend/src/likes/*, backend/src/playlists/*, backend/src/servers/*, backend/src/cors.ts, frontend/src/* for all UI components, README.md, scripts/smoke.sh)
- suggested_phases: P1a, P1b, P1c, P1d (above)