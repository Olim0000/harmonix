/**
 * Player API wrappers (T35).
 */
import { api } from './client';
import type { PlayerStatus, RepeatMode } from '../types/api';

// ─── Status ──────────────────────────────────────────────

export function fetchPlayerStatus(): Promise<PlayerStatus> {
  return api<PlayerStatus>('/player/status');
}

// ─── Play ────────────────────────────────────────────────

export function playTrack(trackId: number, serverId?: number): Promise<void> {
  return api<void>('/player/play', {
    method: 'POST',
    body: JSON.stringify({ trackId, ...(serverId != null ? { serverId } : {}) }),
  });
}

// ─── Pause ───────────────────────────────────────────────

export function pause(): Promise<void> {
  return api<void>('/player/pause', { method: 'POST' });
}

// ─── Resume ──────────────────────────────────────────────

export function resume(): Promise<void> {
  return api<void>('/player/resume', { method: 'POST' });
}

// ─── Stop ────────────────────────────────────────────────

export function stop(): Promise<void> {
  return api<void>('/player/stop', { method: 'POST' });
}

// ─── Seek ────────────────────────────────────────────────

export function seek(position: number): Promise<void> {
  return api<void>('/player/seek', {
    method: 'POST',
    body: JSON.stringify({ position }),
  });
}

// ─── Volume ──────────────────────────────────────────────

export function setVolume(level: number): Promise<void> {
  return api<void>('/player/volume', {
    method: 'POST',
    body: JSON.stringify({ level }),
  });
}

// ─── Shuffle ─────────────────────────────────────────────

export function toggleShuffle(): Promise<void> {
  return api<void>('/player/shuffle', { method: 'POST' });
}

// ─── Repeat ──────────────────────────────────────────────

export function setRepeat(mode: RepeatMode): Promise<void> {
  return api<void>('/player/repeat', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}
