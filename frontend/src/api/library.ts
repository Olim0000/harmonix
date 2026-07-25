/**
 * Library / search / likes API wrappers.
 */
import { api } from './client';
import type {
  Artist,
  Album,
  SearchResult,
  LikeItem,
  LikeResponse,
  ArtistDetailResponse,
  AlbumDetailResponse,
} from '../types/api';

// ─── Artists ───────────────────────────────────────────────

export function fetchArtists(): Promise<Artist[]> {
  return api<Artist[]>('/artists');
}

export function fetchArtist(id: number): Promise<ArtistDetailResponse> {
  return api<ArtistDetailResponse>(`/artists/${id}`);
}

// ─── Albums ────────────────────────────────────────────────

export function fetchAlbums(): Promise<Album[]> {
  return api<Album[]>('/albums');
}

export function fetchAlbum(id: number): Promise<AlbumDetailResponse> {
  return api<AlbumDetailResponse>(`/albums/${id}`);
}

// ─── Search ────────────────────────────────────────────────

export function search(q: string): Promise<SearchResult[]> {
  return api<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`);
}

// ─── Likes ─────────────────────────────────────────────────

export function toggleLike(
  itemType: 'track' | 'artist' | 'album',
  itemId: number
): Promise<LikeResponse> {
  return api<LikeResponse>('/likes', {
    method: 'POST',
    body: JSON.stringify({ itemType, itemId: String(itemId) }),
  });
}

export function fetchLikes(itemType?: 'track' | 'artist' | 'album'): Promise<LikeItem[]> {
  const qs = itemType ? `?itemType=${itemType}` : '';
  return api<LikeItem[]>(`/likes${qs}`);
}
