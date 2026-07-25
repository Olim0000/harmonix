/**
 * Player store (T35, T36, T38, T39) — Zustand with localStorage queue persistence.
 *
 * Manages playback state, queue, shuffle/repeat, volume, fullscreen overlay.
 * Polls /api/player/status every 1s when playing.
 */
import { create } from 'zustand';
import type { Track, RepeatMode, QueueItem } from '../types/api';
import * as playerApi from '../api/player';

// ─── Queue persistence ────────────────────────────────────

const QUEUE_KEY = 'harmonix-queue';
const QUEUE_INDEX_KEY = 'harmonix-queue-index';

function loadQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadQueueIndex(): number {
  try {
    const raw = localStorage.getItem(QUEUE_INDEX_KEY);
    return raw != null ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

function persistQueue(queue: QueueItem[], queueIndex: number) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  localStorage.setItem(QUEUE_INDEX_KEY, String(queueIndex));
}

// ─── Store ────────────────────────────────────────────────

interface PlayerState {
  // Playback
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  currentServerId: number;

  // Queue
  queue: QueueItem[];
  queueIndex: number;

  // UI
  fullscreen: boolean;
  queueOpen: boolean;

  // Polling
  _pollTimer: ReturnType<typeof setInterval> | null;

  // ── Playback actions ──────────────────────────────────────

  /** Play a track, optionally on a specific server. */
  playTrack: (trackId: number, serverId?: number) => Promise<void>;

  /** Pause playback. */
  pause: () => Promise<void>;

  /** Resume playback. */
  resume: () => Promise<void>;

  /** Stop playback. */
  stop: () => Promise<void>;

  /** Seek to position. */
  seek: (position: number) => Promise<void>;

  /** Set volume level (0-100). */
  setVolume: (level: number) => Promise<void>;

  /** Toggle shuffle (mutually exclusive with repeat). */
  toggleShuffle: () => Promise<void>;

  /** Cycle repeat mode (mutually exclusive with shuffle). */
  cycleRepeat: () => Promise<void>;

  // ── Queue actions ──────────────────────────────────────────

  /** Add a track to the end of the queue. */
  enqueue: (track: Track, source?: string) => void;

  /** Remove a track from the queue by index. */
  removeFromQueue: (index: number) => void;

  /** Reorder queue items. */
  reorderQueue: (fromIndex: number, toIndex: number) => void;

  /** Clear the entire queue. */
  clearQueue: () => void;

  /** Play from queue at a given index. */
  playFromQueue: (index: number) => Promise<void>;

  // ── Navigation ─────────────────────────────────────────────

  /** Play next track in queue. */
  next: () => Promise<void>;

  /** Play previous track in queue. */
  prev: () => Promise<void>;

  // ── UI actions ─────────────────────────────────────────────

  toggleFullscreen: () => void;
  toggleQueue: () => void;
  setQueueOpen: (open: boolean) => void;

  // ── Sync ───────────────────────────────────────────────────

  /** Sync state from server status. */
  syncStatus: (status: import('../types/api').PlayerStatus) => void;

  /** Start polling player status. */
  startPolling: () => void;

  /** Stop polling player status. */
  stopPolling: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 80,
  shuffle: false,
  repeat: 'none',
  currentServerId: 0,
  queue: loadQueue(),
  queueIndex: loadQueueIndex(),
  fullscreen: false,
  queueOpen: false,
  _pollTimer: null,

  // ── Playback actions ──────────────────────────────────────

  playTrack: async (trackId, serverId) => {
    try {
      await playerApi.playTrack(trackId, serverId);
      // Status will be synced on next poll
    } catch {
      // ignore — poll will sync eventually
    }
  },

  pause: async () => {
    try {
      await playerApi.pause();
    } catch { /* noop */ }
  },

  resume: async () => {
    try {
      await playerApi.resume();
    } catch { /* noop */ }
  },

  stop: async () => {
    try {
      await playerApi.stop();
    } catch { /* noop */ }
  },

  seek: async (position) => {
    try {
      await playerApi.seek(position);
      set({ position });
    } catch { /* noop */ }
  },

  setVolume: async (level) => {
    const clamped = Math.max(0, Math.min(100, level));
    set({ volume: clamped });
    try {
      await playerApi.setVolume(clamped);
    } catch { /* noop */ }
  },

  toggleShuffle: async () => {
    const { shuffle } = get();
    try {
      await playerApi.toggleShuffle();
      set({ shuffle: !shuffle, repeat: !shuffle ? 'none' : get().repeat });
    } catch { /* noop */ }
  },

  cycleRepeat: async () => {
    const { repeat } = get();
    let next: RepeatMode;
    if (repeat === 'none') next = 'repeat';
    else if (repeat === 'repeat') next = 'repeat-one';
    else next = 'none';

    try {
      await playerApi.setRepeat(next);
      set({ repeat: next, shuffle: next !== 'none' ? false : get().shuffle });
    } catch { /* noop */ }
  },

  // ── Queue actions ─────────────────────────────────────────

  enqueue: (track, source) => {
    const item: QueueItem = { track, source };
    set((s) => {
      const queue = [...s.queue, item];
      persistQueue(queue, s.queueIndex);
      return { queue };
    });
  },

  removeFromQueue: (index) => {
    set((s) => {
      const queue = s.queue.filter((_, i) => i !== index);
      let queueIndex = s.queueIndex;
      if (index < queueIndex) queueIndex = Math.max(0, queueIndex - 1);
      else if (index === queueIndex && queueIndex >= queue.length) {
        queueIndex = Math.max(0, queue.length - 1);
      }
      persistQueue(queue, queueIndex);
      return { queue, queueIndex };
    });
  },

  reorderQueue: (fromIndex, toIndex) => {
    set((s) => {
      const queue = [...s.queue];
      const [moved] = queue.splice(fromIndex, 1);
      queue.splice(toIndex, 0, moved);
      let queueIndex = s.queueIndex;
      if (fromIndex === queueIndex) {
        queueIndex = toIndex;
      } else if (
        fromIndex < queueIndex &&
        toIndex >= queueIndex
      ) {
        queueIndex = Math.max(0, queueIndex - 1);
      } else if (
        fromIndex > queueIndex &&
        toIndex <= queueIndex
      ) {
        queueIndex = Math.min(queue.length - 1, queueIndex + 1);
      }
      persistQueue(queue, queueIndex);
      return { queue, queueIndex };
    });
  },

  clearQueue: () => {
    persistQueue([], 0);
    set({ queue: [], queueIndex: 0 });
  },

  playFromQueue: async (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    const track = queue[index].track;
    set({ queueIndex: index });
    persistQueue(queue, index);
    try {
      await playerApi.playTrack(track.id);
    } catch { /* noop */ }
  },

  // ── Navigation ─────────────────────────────────────────────

  next: async () => {
    const { queue, queueIndex } = get();
    if (queueIndex < queue.length - 1) {
      const nextIndex = queueIndex + 1;
      const track = queue[nextIndex].track;
      set({ queueIndex: nextIndex });
      persistQueue(queue, nextIndex);
      try {
        await playerApi.playTrack(track.id);
      } catch { /* noop */ }
    }
  },

  prev: async () => {
    const { queue, queueIndex, position } = get();
    // If more than 3s in, restart current track
    if (position > 3) {
      try {
        await playerApi.seek(0);
        set({ position: 0 });
      } catch { /* noop */ }
      return;
    }
    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1;
      const track = queue[prevIndex].track;
      set({ queueIndex: prevIndex });
      persistQueue(queue, prevIndex);
      try {
        await playerApi.playTrack(track.id);
      } catch { /* noop */ }
    }
  },

  // ── UI actions ────────────────────────────────────────────

  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),
  setQueueOpen: (open) => set({ queueOpen: open }),

  // ── Sync ──────────────────────────────────────────────────

  syncStatus: (status) => {
    set({
      currentTrack: status.currentTrack,
      isPlaying: status.isPlaying,
      position: status.position,
      duration: status.duration,
      volume: status.volume,
      shuffle: status.shuffle,
      repeat: status.repeat,
      currentServerId: status.serverId,
    });
  },

  startPolling: () => {
    const state = get();
    if (state._pollTimer) return;

    const timer = setInterval(async () => {
      // M7: Only poll when something is playing or a track is loaded
      const current = get();
      if (!current.isPlaying && !current.currentTrack) return;
      try {
        const status = await playerApi.fetchPlayerStatus();
        get().syncStatus(status);
      } catch {
        // silent — network may be unavailable
      }
    }, 1000);

    set({ _pollTimer: timer });
  },

  stopPolling: () => {
    const timer = get()._pollTimer;
    if (timer) {
      clearInterval(timer);
      set({ _pollTimer: null });
    }
  },
}));
