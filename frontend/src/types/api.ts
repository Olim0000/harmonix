/**
 * Frontend API types — clean separation from backend types.
 * Duplicated intentionally to avoid backend coupling.
 */

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Artist {
  id: number;
  name: string;
  sort_name: string | null;
  image_path: string | null;
  album_count?: number;
}

export interface Album {
  id: number;
  artist_id: number;
  title: string;
  year: number | null;
  cover_path: string | null;
  artist_name?: string;
  track_count?: number;
}

export interface Track {
  id: number;
  album_id: number;
  artist_id: number;
  title: string;
  track_number: number | null;
  file_path: string;
  duration_seconds: number | null;
  artist_name?: string;
  album_title?: string;
}

export interface SearchResult {
  type: 'track' | 'album' | 'artist';
  id: number;
  title: string;
  artist_name?: string;
  album_title?: string;
  track_number?: number;
  duration_seconds?: number;
  year?: number;
  cover_path?: string;
}

export interface LikeItem {
  itemType: 'track' | 'artist' | 'album';
  itemId: number;
  createdAt: string;
  title?: string;
  name?: string;
  artist?: string;
  album?: string;
}

export interface LikeResponse {
  liked: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface MeResponse {
  user: User;
}

export interface RefreshResponse {
  token: string;
}

export interface ArtistDetailResponse {
  artist: Artist;
  albums: (Album & { track_count: number })[];
}

export interface AlbumDetailResponse {
  album: Album & { artist_name: string };
  tracks: (Track & { artist_name: string; album_title: string })[];
}

export interface SourceInfo {
  isSource: boolean;
  hasMusicDir?: boolean;
  musicDir?: string | null;
}

// ─── Playlists (T32, T33) ────────────────────────────────

export interface Playlist {
  id: number;
  name: string;
  track_count: number;
  created_at: string;
}

export interface PlaylistDetailResponse {
  playlist: Playlist;
  tracks: Track[];
}

// ─── Servers (T34) ────────────────────────────────────────

export interface Server {
  id: number;
  name: string;
  host: string;
  port: number;
  created_at: string;
}

export interface ServerStatus {
  online: boolean;
}

// ─── Player (T35) ────────────────────────────────────────

export type RepeatMode = 'none' | 'repeat' | 'repeat-one';

export interface PlayerStatus {
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  serverId: number;
  trackEnd: boolean;
}

export interface QueueItem {
  track: Track;
  /** Source label shown in queue (e.g. album name, playlist name) */
  source?: string;
}

// ─── Admin (T14) ─────────────────────────────────────────

export interface AdminUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface ScanProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}
