/**
 * Playlists API wrappers (T32, T33).
 */
import { api } from './client';
import type { Playlist, PlaylistDetailResponse } from '../types/api';

// ─── List ────────────────────────────────────────────────

export function fetchPlaylists(): Promise<Playlist[]> {
  return api<{ playlists: Playlist[] }>('/playlists').then((r) => r.playlists);
}

// ─── Create ──────────────────────────────────────────────

export function createPlaylist(name: string): Promise<Playlist> {
  return api<{ playlist: Playlist }>('/playlists', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }).then((r) => r.playlist);
}

// ─── Get Detail ──────────────────────────────────────────

export function fetchPlaylistDetail(id: number): Promise<PlaylistDetailResponse> {
  return api<PlaylistDetailResponse>(`/playlists/${id}`);
}

// ─── Rename ──────────────────────────────────────────────

export function renamePlaylist(id: number, name: string): Promise<Playlist> {
  return api<{ playlist: Playlist }>(`/playlists/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  }).then((r) => r.playlist);
}

// ─── Delete ──────────────────────────────────────────────

export function deletePlaylist(id: number): Promise<void> {
  return api<void>(`/playlists/${id}`, { method: 'DELETE' });
}

// ─── Add Track ───────────────────────────────────────────

export function addTrackToPlaylist(
  playlistId: number,
  trackId: number
): Promise<void> {
  return api<void>(`/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ trackId }),
  });
}

// ─── Remove Track ────────────────────────────────────────

export function removeTrackFromPlaylist(
  playlistId: number,
  trackId: number
): Promise<void> {
  return api<void>(`/playlists/${playlistId}/tracks/${trackId}`, {
    method: 'DELETE',
  });
}

// ─── Reorder ─────────────────────────────────────────────

export function reorderPlaylist(
  playlistId: number,
  trackIds: number[]
): Promise<void> {
  return api<void>(`/playlists/${playlistId}/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ trackIds }),
  });
}
