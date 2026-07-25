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

export interface Like {
  user_id: number;
  item_type: 'track' | 'artist' | 'album';
  item_id: number;
  created_at: string;
}

export interface Playlist {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  track_count?: number;
}

export interface PlaylistItem {
  playlist_id: number;
  track_id: number;
  position: number;
}

export interface Server {
  id: number;
  user_id: number;
  name: string;
  host: string;
  port: number;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}