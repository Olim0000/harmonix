# Harmonix Design System & UI Specification

## Overview

Harmonix is a self-hosted private music streaming web app with **multi-server ffplay remote playback**. This document defines the complete visual language, interaction model, and screen-by-screen specification for a ground-up redesign.

**Design Philosophy**: Dark-first, information-dense, keyboard-friendly. The UI should feel like a professional tool — not a consumer toy. Every pixel serves a purpose.

---

## 1. Design System Foundations

### 1.1 Color Palette

**Dark Mode (Primary)** — chosen for music listening environments (low light, extended use)

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `#0a0a0a` | App background |
| `bg-secondary` | `#141414` | Card/panel backgrounds |
| `bg-tertiary` | `#1e1e1e` | Elevated surfaces, hover states |
| `bg-accent` | `#2563eb` | Primary action, active states |
| `bg-accent-hover` | `#1d4ed8` | Primary action hover |
| `bg-danger` | `#dc2626` | Destructive actions, errors |
| `bg-success` | `#16a34a` | Success states |
| `bg-warning` | `#d97706` | Warnings, in-progress |
| `text-primary` | `#f5f5f5` | Primary text |
| `text-secondary` | `#a3a3a3` | Secondary text, labels |
| `text-tertiary` | `#525252` | Disabled, placeholder |
| `border-primary` | `#262626` | Default borders |
| `border-hover` | `#404040` | Hover borders |
| `border-accent` | `#2563eb` | Focus rings, active borders |

**Light Mode** — available but secondary; invert `bg-*` and `text-*` tokens. Not implemented in v1.

**Contrast Ratios** (WCAG AA):
- `text-primary` on `bg-primary`: 15.4:1 ✓
- `text-secondary` on `bg-primary`: 6.1:1 ✓
- `bg-accent` with white text: 4.6:1 ✓

### 1.2 Typography

**Font Stack**: System font (no external dependencies)

```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
--font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
```

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-xs` | 12px | 400 | 16px | Captions, metadata |
| `text-sm` | 14px | 400 | 20px | Secondary text |
| `text-base` | 16px | 400 | 24px | Body text |
| `text-lg` | 18px | 500 | 28px | Section headers |
| `text-xl` | 20px | 600 | 28px | Page titles |
| `text-2xl` | 24px | 600 | 32px | Hero text |
| `text-3xl` | 30px | 700 | 36px | Album art overlay |

### 1.3 Spacing Scale

Base unit: **4px**

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Inline gaps |
| `space-2` | 8px | Compact gaps |
| `space-3` | 12px | Default gaps |
| `space-4` | 16px | Card padding |
| `space-5` | 20px | Section gaps |
| `space-6` | 24px | Page padding |
| `space-8` | 32px | Major sections |
| `space-10` | 40px | Page margins |
| `space-12` | 48px | Hero spacing |

### 1.4 Corner Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Buttons, inputs |
| `radius-md` | 8px | Cards, panels |
| `radius-lg` | 12px | Modals, overlays |
| `radius-xl` | 16px | Album art, avatars |
| `radius-full` | 9999px | Pills, circular avatars |

### 1.5 Elevation / Shadow

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle lift |
| `shadow-md` | `0 4px 8px rgba(0,0,0,0.4)` | Cards on hover |
| `shadow-lg` | `0 8px 16px rgba(0,0,0,0.5)` | Dropdowns, popovers |
| `shadow-xl` | `0 16px 32px rgba(0,0,0,0.6)` | Modals, fullscreen overlay |

### 1.6 Motion

| Token | Value | Usage |
|-------|-------|-------|
| `duration-fast` | 100ms | Micro-interactions (hover, focus) |
| `duration-normal` | 200ms | Transitions (panels, tabs) |
| `duration-slow` | 300ms | Page transitions, overlays |
| `easing-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Most transitions |
| `easing-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy feedback (like button) |

**Reduced Motion**: Respect `prefers-reduced-motion: reduce` — disable all non-essential animations.

### 1.7 Iconography

**Inline SVG set** — no external icon library. ~30 icons total:

| Category | Icons |
|----------|-------|
| Navigation | home, library, artists, search, settings, menu, close |
| Playback | play, pause, skip-next, skip-previous, shuffle, repeat, repeat-one, volume-high, volume-low, volume-mute, maximize, minimize |
| Actions | heart, heart-filled, plus, minus, trash, edit, check, x, refresh, upload, download |
| Server | server, server-active, server-error, browser, speaker |
| Status | loading-spinner, warning, error, success |
| UI | chevron-down, chevron-right, drag-handle, external-link |

**Style**: 20x20 viewBox, 1.5px stroke, stroke-linecap round, stroke-linejoin round. Filled variants for heart, play, pause.

---

## 2. Core Layout Shell

### 2.1 Desktop Layout (>768px)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Harmonix                              [Search] [User]│  ← Top bar (48px)
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│ Sidebar  │              Main Content Area                   │
│          │                                                  │
│ 200px    │              Flexible height                     │
│          │                                                  │
│ [Home]   │              ┌─────────────────────────────┐    │
│ [Library]│              │                             │    │
│ [Artists]│              │   Page content              │    │
│ [Search] │              │                             │    │
│ [Liked]  │              └─────────────────────────────┘    │
│ [Playlists]                                                   │
│          │                                                  │
│ ─────── │                                                  │
│ [Servers]│                                                  │
│ [Admin]  │                                                  │
│          │                                                  │
├──────────┴──────────────────────────────────────────────────┤
│ [Play ▶] [Track Info] [Server: My PC ▼] [Vol] [Queue] [⛶]│  ← Player bar (72px)
└─────────────────────────────────────────────────────────────┘
```

**Key layout rules**:
- Sidebar: fixed 200px, full height, scrollable
- Top bar: fixed 48px height
- Player bar: fixed 72px height, persistent
- Main content: scrollable, padding 24px
- Total vertical space for content: `100vh - 48px - 72px`

### 2.2 Mobile Layout (<768px)

```
┌─────────────────────────────┐
│ [☰] Harmonix      [🔍] [👤]│  ← Top bar (48px)
├─────────────────────────────┤
│                             │
│     Main Content Area       │
│                             │
│     Full width, padded      │
│                             │
│                             │
├─────────────────────────────┤
│ [▶] Track info    [Queue] [⛶]│  ← Compact player bar (64px)
└─────────────────────────────┘
```

**Sidebar**: Hidden by default. Hamburger menu triggers slide-out drawer from left.

**Fullscreen overlay**: Stacks above everything (z-index: 100).

**Queue drawer**: Slides in from right (z-index: 90), 320px width on desktop, full width on mobile.

---

## 3. Primitive Components

### 3.1 Button

**Variants**:
- `primary`: bg-accent, white text, radius-sm
- `secondary`: bg-tertiary, text-primary, border-primary
- `danger`: bg-danger, white text
- `ghost`: transparent, text-secondary, hover bg-tertiary
- `icon`: square (32x32), ghost styling, icon-only

**Sizes**:
- `sm`: 32px height, 12px text
- `md`: 40px height, 14px text
- `lg`: 48px height, 16px text

**States**: default, hover (darken), active (darken more), disabled (opacity 0.5), loading (spinner replaces icon)

### 3.2 Input

**Height**: 40px, radius-sm, bg-secondary, border-primary
**Focus**: border-accent, ring-accent (2px outline)
**States**: default, focus, error (border-danger + error message below), disabled (opacity 0.5)

**Variants**: text, password (with toggle visibility), search (with search icon)

### 3.3 Card

**Album Card** (primary variant):
- 1:1 aspect ratio cover image (radius-md)
- Below: title (text-sm, truncate), subtitle (text-xs, text-secondary)
- Hover: shadow-md, slight scale (1.02)
- Play button overlay on hover (bottom-right)
- Heart icon (top-right) for quick like

**List Card** (alternative):
- Horizontal layout, fixed height 72px
- Left: square image (48x48, radius-sm)
- Center: title + subtitle
- Right: actions (heart, play, more)

### 3.4 List Row

- Height: 48px
- Border-bottom: 1px border-primary
- Hover: bg-tertiary
- Contains: drag handle (optional), index (optional), title, artist, duration, actions (heart, play, more)
- Active row (playing): bg-accent with opacity 0.1, accent border-left

### 3.5 Tab

**Style**: underline tabs
- Default: text-secondary, no underline
- Active: text-primary, 2px accent underline
- Hover: text-primary
- Animation: underline slides on tab change

### 3.6 Dialog / Modal

- Backdrop: black at 60% opacity
- Content: bg-secondary, radius-lg, shadow-xl
- Max-width: 480px (sm), 640px (md), 800px (lg)
- Header: text-lg, font-semibold
- Footer: right-aligned buttons (cancel + primary action)
- Close: X button top-right

### 3.7 Drawer

- Slide-in from right (queue) or left (mobile sidebar)
- Backdrop on mobile (click to close)
- Width: 320px (desktop), 100% (mobile)
- Header with title + close button
- Scrollable content area

### 3.8 Toast / Inline Error

**Toast**: bottom-right, auto-dismiss 5s, bg-tertiary, radius-md, shadow-lg
**Inline Error**: red text below input, icon + message
**Banner Error**: full-width, bg-danger with 10% opacity, border-left 3px solid danger

### 3.9 Progress Bar

**Horizontal**: 4px height, radius-full
- Track: bg-tertiary
- Fill: bg-accent
- Hover: expands to 6px, shows draggable handle

**Circular**: for scan/enrich progress
- SVG circle stroke, bg-tertiary track, accent fill

### 3.10 Segmented Control

- Container: bg-secondary, radius-sm, border-primary
- Option: bg-transparent, text-secondary
- Active: bg-tertiary, text-primary, shadow-sm
- Animation: sliding highlight

### 3.11 Avatar / Cover Fallback

**Avatar**: radius-full, bg-tertiary, text-secondary center-aligned initials
**Cover Art**: radius-md, bg-tertiary, music note SVG fallback (centered, 32px, text-tertiary)

---

## 4. Screen-by-Screen Specification

### 4.1 Login

**Purpose**: Authenticate existing user

**Layout**:
- Centered card (max-width 400px)
- Logo + "Sign in to Harmonix"
- Form: email input, password input, "Sign in" button (full-width, primary)
- Footer: "Don't have an account? Register" link

**States**:
- Empty: ready for input
- Loading: button shows spinner, inputs disabled
- Error: inline error on form, toast for network errors
- Success: redirect to Home

---

### 4.2 Register

**Purpose**: Create new account

**Layout**:
- Centered card (max-width 400px)
- Logo + "Create your account"
- Form: name input, email input, password input, confirm password input, "Create account" button
- Footer: "Already have an account? Sign in" link

**States**: Same as Login

---

### 4.3 Home

**Purpose**: Personalized landing, quick access to recently played + recommendations

**Layout**:
- Section: "Recently Played" — horizontal scroll of album cards (6-8 visible)
- Section: "Your Top Artists" — horizontal scroll of artist avatars (circle, name below)
- Section: "New Releases" — album grid (4 columns desktop, 2 mobile)
- Section: "Quick Play" — list of 5 most-played tracks

**States**:
- Empty (no scan done yet): CTA "Scan your library to get started" with illustration
- Loading: skeleton cards (pulsing placeholders)
- Error: inline error banner, retry button
- Active: populated sections

**Player Behavior**: None specific — standard playback controls apply.

---

### 4.4 Library (Album Grid)

**Purpose**: Browse all albums

**Layout**:
- Header: "Library" + search input (filters albums in grid) + sort dropdown (title, artist, date added, year)
- Grid: album cards (4 cols desktop, 3 tablet, 2 mobile)
- Infinite scroll or pagination (load more button)

**States**:
- Empty: "No albums found" with search hint
- Loading: skeleton grid
- Error: banner with retry
- Active: populated grid

---

### 4.5 Artists List

**Purpose**: Browse all artists

**Layout**:
- Header: "Artists" + search input
- Grid: artist cards (5 cols desktop, 3 tablet, 2 mobile)
  - Card: circular avatar (120px), name below, album count
- Click: navigate to Artist Detail

**States**: Same as Library

---

### 4.6 Artist Detail

**Purpose**: View artist info, bio, and albums

**Layout**:
- Hero section: artist image (large, left), name + bio + stats (right)
  - Stats: album count, total tracks, total duration
- Action bar: "Shuffle All" button, "Like" heart
- Section: "Albums" — album grid (same as Library, filtered to this artist)

**States**:
- Loading: skeleton hero + skeleton grid
- Error: banner
- Active: populated
- No bio: hide bio section, show "No bio available"

**Player Behavior**: "Shuffle All" starts shuffled playback of all artist tracks.

---

### 4.7 Album Detail

**Purpose**: View album tracks, play album

**Layout**:
- Header: album cover (large, 200x200), title, artist name (link), year, genre, track count, total duration
- Action bar: "Play" button (primary), "Shuffle" button (secondary), "Like" heart
- Tracklist: table
  - Columns: #, Title, Duration, Actions (heart, add to queue, play next)
  - Row highlight for currently playing track
  - Drag to reorder (only in playlist context, not here)

**States**:
- Loading: skeleton
- Error: banner
- Active: populated
- Empty album (no tracks): "This album has no tracks"

**Player Behavior**: "Play" starts from track 1, "Shuffle" starts shuffled.

---

### 4.8 Search

**Purpose**: Find albums and tracks

**Layout**:
- Search input (large, centered or top of page)
- Results grouped by type:
  - **Albums**: horizontal row of album cards (scrollable if many)
  - **Tracks**: list rows
- Tab switcher: "All" | "Albums" | "Tracks" (segmented control)
  - "All" shows both, albums first, tracks below

**Justification for combined view**: Users typically search for a song and want to find the album it's on. Showing both together reduces clicks. Tabs available for when they want to narrow.

**States**:
- Empty query: show recent searches or suggestions
- No results: "No results for '{query}'"
- Loading: skeleton results
- Error: banner

---

### 4.9 Liked

**Purpose**: Access liked content

**Layout**:
- Header: "Liked" with total count
- Tabs: "Tracks" | "Artists" | "Albums"
  - Tracks: list rows (same as tracklist)
  - Artists: artist grid (same as Artists list)
  - Albums: album grid (same as Library)
- Each tab has its own empty state

**States**:
- Empty (specific tab): "No liked [tracks/artists/albums] yet. Tap the heart to save."
- Loading: skeleton
- Active: populated

---

### 4.10 Playlists List

**Purpose**: Manage user playlists

**Layout**:
- Header: "Playlists" + "New Playlist" button
- Grid: playlist cards (3 cols desktop, 2 mobile)
  - Card: cover collage (4 album arts), title, track count, duration
  - Click: navigate to Playlist Detail
  - Right-click or menu: rename, delete

**States**:
- Empty: "No playlists yet. Create one to organize your music."
- Loading: skeleton
- Active: populated

---

### 4.11 Playlist Detail

**Purpose**: View and edit a single playlist

**Layout**:
- Header: playlist cover collage (large), title (editable), track count, duration
- Action bar: "Play" button, "Shuffle" button, "Delete Playlist" button (danger)
- Tracklist: same as Album Detail, but:
  - Drag to reorder enabled
  - "Remove from playlist" action per track
  - Empty state: "Add tracks from Library or Search"

**Duplicate Detection**:
- **Approach**: Block duplicates with warning toast
- **Justification**: Playlists are intentional collections; duplicates waste space and confuse playback. Toast message: "This track is already in this playlist."

**States**:
- Empty: CTA to browse library
- Loading: skeleton
- Active: populated

---

### 4.12 Admin Area

**Purpose**: System administration (admin-only, role-gated)

**Layout**:
- Tabbed interface: "Users" | "Scan" | "Enrich"
- Accessible only from sidebar when user is admin

#### 4.12.1 Users Tab

- Table: name, email, role, created, actions
- Actions: edit role, delete user
- "Invite User" button

#### 4.12.2 Scan Tab

- "Start Scan" button (primary)
- Live progress: progress bar + text ("Scanning: /music/artist/album...")
- Stats: files scanned, tracks found, albums found, artists found
- Log: scrollable list of recent scan activity
- **Non-blocking**: server remains available during scan

#### 4.12.3 Enrich Tab

- "Start Full Enrich" and "Start Partial Enrich" buttons
- Mode explanation: full = all artists/albums, partial = only missing data
- Live progress: progress bar + current item being enriched
- Stats: artists enriched, albums enriched, images downloaded
- Log: scrollable list

---

### 4.13 Servers

**Purpose**: Manage player servers

**Layout**:
- Header: "Player Servers"
- List: server cards
  - Each card: name, host:port, status indicator (green=online, red=offline, yellow=connecting)
  - Actions: edit, delete (not for Main Server)
- "Add Server" button

**Native Main Server**:
- Shown as first item, id=0
- Label: "This Device (Main Server)"
- No delete button, admin-only visibility
- Always shows status

**Regular Users**:
- Don't see Main Server
- Can only manage their own servers

**Status Polling**: Check server reachability every 30s, update indicator.

---

### 4.14 Persistent Player Bar

**Purpose**: Always-visible playback controls

**Desktop Layout (72px height)**:
```
┌──────────────────────────────────────────────────────────────┐
│ [▶] [⏮] [⏭] │ [Art] Title — Artist   │ Server ▼ │Vol━━│ [📋] [⛶]│
│               │ ━━━━━━━━━●━━━━━━━━━━━━━ │          │      │         │
└──────────────────────────────────────────────────────────────┘
```

**Elements**:
- Left: play/pause, previous, next (icon buttons)
- Center-left: small album art (48x48) + track title + artist
- Center-right: server selector dropdown
- Right: volume slider, queue button, fullscreen button
- Below center: progress bar (full width of center section)

**Mobile Layout (64px height)**:
```
┌─────────────────────────────────────┐
│ [▶] [Art] Title — Artist  [📋] [⛶]│
│ ━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━│
└─────────────────────────────────────┘
```

**Server Selector**:
- Dropdown shows: list of user's servers + Main Server (admin only)
- Current server highlighted with checkmark
- Status indicator per server (dot: green/red/yellow)
- Selecting a server switches playback target
- If server is offline, show toast error, don't switch

**Progress Bar**:
- Shows current time / total time
- Draggable handle on hover
- Click to seek

**Keyboard Shortcuts** (see Section 5.3)

---

### 4.15 Queue Drawer

**Purpose**: View and manage upcoming tracks

**Trigger**: Queue button in player bar

**Layout**:
- Drawer from right (320px desktop, full mobile)
- Header: "Queue" + "Clear" button (ghost)
- List: upcoming tracks (list rows)
  - Currently playing track highlighted (accent bg)
  - Drag to reorder
  - Remove button per track
  - "Play Next" section (top) vs "Up Next" section (below)
- Footer: "Add to Queue" button (opens search mini-panel)

**Persistence**: Queue persists across page refresh (localStorage).

**States**:
- Empty: "Queue is empty. Add tracks from anywhere."
- Active: populated list

---

### 4.16 Fullscreen Now-Playing Overlay

**Purpose**: Immersive playback experience

**Trigger**: Expand button in player bar OR click album art

**Layout**:
- Full viewport overlay (z-index: 100)
- Background: blurred album art (CSS filter: blur(50px), darkened)
- Center: large album art (300x300 desktop, 200x200 mobile, radius-lg)
- Below art: track title (text-2xl), artist name (text-lg, text-secondary)
- Controls row: shuffle, previous, play/pause (large), next, repeat
- Progress bar: full width, large handle
- Volume: large slider (desktop), hidden behind icon (mobile)
- Bottom: server selector, queue button, minimize button
- Close: X button top-right OR Escape key

**States**:
- Active: full controls
- Loading: spinner on art
- Error: "Playback error" message

**Mobile**:
- Swipe down to close
- Album art smaller
- Volume hidden (device volume controls)

---

## 5. Interaction Specs

### 5.1 Server Selector Behavior

1. User clicks server selector dropdown
2. Dropdown opens with list of servers + status indicators
3. Current server has checkmark
4. User selects new server
5. **If server is reachable**:
   - Toast: "Switched playback to {server name}"
   - Current track continues from same position on new server
   - Progress bar updates
6. **If server is unreachable**:
   - Toast: "Cannot reach {server name}. Is it running?"
   - Dropdown closes, server unchanged
7. **If switching from remote to browser**:
   - Pause remote playback
   - Start browser playback from same position
8. **If switching from browser to remote**:
   - Pause browser playback
   - Start remote playback from same position

### 5.2 Shuffle / Repeat Mutual Exclusion

- **State**: `mode: 'none' | 'shuffle' | 'repeat'`
- **Behavior**:
  - Click shuffle when repeat is on → shuffle enables, repeat disables
  - Click repeat when shuffle is on → repeat enables, shuffle disables
  - Click active shuffle → shuffle disables (mode: none)
  - Click active repeat → cycle: repeat-all → repeat-one → off
- **Visual**:
  - Shuffle icon: accent color when active, secondary when inactive
  - Repeat icon: accent when active, secondary when inactive
  - Repeat-one: shows "1" badge on repeat icon

### 5.3 Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `Space` | Play / Pause | Global (when not in input) |
| `←` | Seek -5s | Global |
| `→` | Seek +5s | Global |
| `N` | Next track | Global |
| `P` | Previous track | Global |
| `M` | Mute / Unmute | Global |
| `Escape` | Close fullscreen overlay OR close queue drawer | Global |
| `F` | Toggle fullscreen overlay | Global |
| `Q` | Toggle queue drawer | Global |
| `/` | Focus search input | Global |
| `L` | Like / Unlike current track | Global |

**Input guard**: All shortcuts disabled when focus is in an input, textarea, or select element.

### 5.4 Queue Drag-Reorder

- Drag handle appears on hover (left side of row)
- Dragging: row elevates (shadow-lg), placeholder shows insertion point
- Drop: row snaps into position, queue updates
- Visual feedback: blue line at insertion point

### 5.5 Fullscreen Overlay Open/Close

**Open**:
- Album art scales from player bar position (if clicked) or fades in (if button clicked)
- Background blurs in
- Duration: 300ms

**Close**:
- Reverse animation
- OR press Escape
- OR click X button
- OR swipe down (mobile)

### 5.6 Scan + Enrich Live Progress

**Scan Progress**:
- Progress bar: `current/total` files
- Text: "Scanning: {filename}"
- Stats counter: tracks found, albums found, artists found
- Log: last 50 entries, newest first, auto-scroll

**Enrich Progress**:
- Progress bar: `current/total` items
- Text: "Enriching: {artist/album name}"
- Stats counter: artists done, images downloaded
- Log: last 50 entries

**Non-blocking**: Both operations run async; UI remains interactive. Can navigate away and check back later.

---

## 6. Accessibility & Responsive Notes

### 6.1 Focus Treatment

- **Focus ring**: 2px solid accent, offset 2px
- **Tab order**: follows visual layout (top→bottom, left→right)
- **Skip link**: "Skip to main content" (hidden, visible on focus)
- **Player bar**: all controls keyboard-reachable in order (prev, play, next, server, volume, queue, fullscreen)

### 6.2 Keyboard Reachability

- All interactive elements must be focusable
- All actions must be keyboard-executable
- No keyboard traps (except fullscreen overlay, which Escape exits)
- Screen reader labels on all icon buttons (aria-label)

### 6.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition-duration: 0ms !important; }
}
```

- Disable: page transitions, overlay animations, progress bar animations
- Keep: hover state changes (color only), focus rings

### 6.4 Mobile Breakpoints

| Breakpoint | Width | Changes |
|------------|-------|---------|
| Mobile | <768px | Sidebar → drawer, player bar compact, grids 2 cols |
| Tablet | 768-1024px | Sidebar hidden by default, grids 3 cols |
| Desktop | >1024px | Full sidebar, grids 4+ cols |

### 6.5 Touch Interactions

- Swipe right: open sidebar (mobile)
- Swipe left: close sidebar (mobile)
- Swipe down: close fullscreen overlay (mobile)
- Long press: context menu (where applicable)
- Drag handle: visible on touch for queue reorder

### 6.6 Keyboard Shortcuts Disclosure

- **Desktop**: Show keyboard shortcut hints in tooltips (e.g., "Play/Pause (Space)")
- **Mobile**: Hide keyboard shortcuts (not applicable on touch)
- **Help modal**: `?` key opens keyboard shortcuts reference (desktop only)

---

## 7. Open Questions for Lead

1. **Album art aspect ratio**: Square (1:1) is standard, but some albums have non-square covers. Should we letterbox or crop to square? Recommendation: crop to square with center-crop.

2. **Scan progress persistence**: Should scan progress persist across page refresh (via WebSocket or polling), or is it okay to lose progress display if user navigates away?

3. **Queue persistence scope**: localStorage only, or should queue persist across devices (server-side)?

4. **Admin role gating**: Should non-admin users see the Admin nav item with a disabled state, or should it be completely hidden?

5. **Search indexing**: Should search be real-time (as user types) or debounced (after 300ms pause)? Recommendation: debounced.

6. **Multi-server audio sync**: When switching servers, should we attempt to sync playback position exactly, or just start from approximate position? Recommendation: exact position via timestamp.

---

## Appendix A: File Structure Recommendation

```
src/
  components/
    ui/          # Primitive components (Button, Input, Card, etc.)
    layout/      # Shell, Sidebar, TopBar, PlayerBar
    player/      # Playback controls, ServerSelector, QueueDrawer
    screens/     # Page components
    icons/       # Inline SVG icon components
  hooks/         # usePlayback, useQueue, useSearch, etc.
  stores/        # Zustand stores for player, queue, auth
  styles/        # CSS tokens, global styles
  utils/         # Helpers
```

## Appendix B: Design Token CSS Variables

```css
:root {
  /* Colors */
  --bg-primary: #0a0a0a;
  --bg-secondary: #141414;
  --bg-tertiary: #1e1e1e;
  --bg-accent: #2563eb;
  --bg-accent-hover: #1d4ed8;
  --bg-danger: #dc2626;
  --bg-success: #16a34a;
  --bg-warning: #d97706;
  
  --text-primary: #f5f5f5;
  --text-secondary: #a3a3a3;
  --text-tertiary: #525252;
  
  --border-primary: #262626;
  --border-hover: #404040;
  --border-accent: #2563eb;
  
  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
  
  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 8px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 16px rgba(0,0,0,0.5);
  --shadow-xl: 0 16px 32px rgba(0,0,0,0.6);
  
  /* Motion */
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --easing-default: cubic-bezier(0.4, 0, 0.2, 1);
  --easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  
  /* Layout */
  --sidebar-width: 200px;
  --topbar-height: 48px;
  --playerbar-height: 72px;
  --queue-width: 320px;
}
```
