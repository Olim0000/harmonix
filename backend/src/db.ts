import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { env } from './env.js';
import { logger } from './logger.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const dbDir = dirname(env.dbPath!);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const coversDir = env.coversDir!;
if (!existsSync(coversDir)) {
  mkdirSync(coversDir, { recursive: true });
}

export const db: DatabaseType = new Database(env.dbPath!);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * FTS5 rowid offsets to avoid collisions between types in the shared contentless table.
 * Artist → ARTIST_OFFSET + artist_id
 * Album  → ALBUM_OFFSET  + album_id
 * Track  → TRACK_OFFSET  + track_id
 */
const ARTIST_OFFSET = 1_000_000_000_000;
const ALBUM_OFFSET = 2_000_000_000_000;
const TRACK_OFFSET = 3_000_000_000_000;

export function ftsRowid(type: 'artist' | 'album' | 'track', id: number): number {
  switch (type) {
    case 'artist': return ARTIST_OFFSET + id;
    case 'album':  return ALBUM_OFFSET + id;
    case 'track':  return TRACK_OFFSET + id;
  }
}

export function ftsTypeAndId(rowid: number): { type: 'artist' | 'album' | 'track'; id: number } {
  if (rowid >= TRACK_OFFSET) return { type: 'track', id: rowid - TRACK_OFFSET };
  if (rowid >= ALBUM_OFFSET) return { type: 'album', id: rowid - ALBUM_OFFSET };
  return { type: 'artist', id: rowid - ARTIST_OFFSET };
}

/**
 * Apply the full schema (tables, indexes, FTS5, triggers) to any database handle.
 * Used by both the production db and test databases.
 */
export function applySchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_name TEXT,
      image_path TEXT
    );

    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      year INTEGER,
      cover_path TEXT
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      artist_id INTEGER NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      track_number INTEGER,
      file_path TEXT NOT NULL UNIQUE,
      duration_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK (item_type IN ('track', 'artist', 'album')),
      item_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, item_type, item_id)
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlist_items (
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      PRIMARY KEY (playlist_id, track_id)
    );

    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- FTS5 virtual table for full-text search across tracks, artists, albums
    -- content='' means only  the index is stored, content is provided on INSERT
    -- contentless_delete=1 enables DELETE/UPDATE (required for sync triggers)
    -- IF NOT EXISTS ensures the table survives restarts; we rebuild the index below
    CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
      title,
      artist_name,
      album_title,
      content='',
      contentless_delete=1,
      tokenize='porter unicode61'
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
    CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
    CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_servers_user ON servers(user_id);

    -- FTS5 sync triggers: keep search_fts in sync with content tables
    -- Uses type-offset rowids to avoid collisions between artist/album/track IDs

    CREATE TRIGGER IF NOT EXISTS after_artist_insert
      AFTER INSERT ON artists
    BEGIN
      INSERT INTO search_fts(rowid, title, artist_name, album_title)
      VALUES (${ARTIST_OFFSET} + new.id, new.name, new.name, '');
    END;

    CREATE TRIGGER IF NOT EXISTS after_artist_delete
      AFTER DELETE ON artists
    BEGIN
      DELETE FROM search_fts WHERE rowid = ${ARTIST_OFFSET} + old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS after_artist_update
      AFTER UPDATE OF name ON artists
    BEGIN
      DELETE FROM search_fts WHERE rowid = ${ARTIST_OFFSET} + old.id;
      INSERT INTO search_fts(rowid, title, artist_name, album_title)
      VALUES (${ARTIST_OFFSET} + new.id, new.name, new.name, '');
    END;

    CREATE TRIGGER IF NOT EXISTS after_album_insert
      AFTER INSERT ON albums
    BEGIN
      INSERT INTO search_fts(rowid, title, artist_name, album_title)
      VALUES (${ALBUM_OFFSET} + new.id, new.title,
        (SELECT name FROM artists WHERE id = new.artist_id), '');
    END;

    CREATE TRIGGER IF NOT EXISTS after_album_delete
      AFTER DELETE ON albums
    BEGIN
      DELETE FROM search_fts WHERE rowid = ${ALBUM_OFFSET} + old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS after_album_update
      AFTER UPDATE OF title, artist_id ON albums
    BEGIN
      DELETE FROM search_fts WHERE rowid = ${ALBUM_OFFSET} + old.id;
      INSERT INTO search_fts(rowid, title, artist_name, album_title)
      VALUES (${ALBUM_OFFSET} + new.id, new.title,
        (SELECT name FROM artists WHERE id = new.artist_id), '');
    END;

    CREATE TRIGGER IF NOT EXISTS after_track_insert
      AFTER INSERT ON tracks
    BEGIN
      INSERT INTO search_fts(rowid, title, artist_name, album_title)
      VALUES (${TRACK_OFFSET} + new.id, new.title,
        (SELECT name FROM artists WHERE id = new.artist_id),
        (SELECT title FROM albums WHERE id = new.album_id));
    END;

    CREATE TRIGGER IF NOT EXISTS after_track_delete
      AFTER DELETE ON tracks
    BEGIN
      DELETE FROM search_fts WHERE rowid = ${TRACK_OFFSET} + old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS after_track_update
      AFTER UPDATE OF title, artist_id, album_id ON tracks
    BEGIN
      DELETE FROM search_fts WHERE rowid = ${TRACK_OFFSET} + old.id;
      INSERT INTO search_fts(rowid, title, artist_name, album_title)
      VALUES (${TRACK_OFFSET} + new.id, new.title,
        (SELECT name FROM artists WHERE id = new.artist_id),
        (SELECT title FROM albums WHERE id = new.album_id));
    END;
  `);
}

export function initSchema(): void {
  applySchema(db);
}

/**
 * Rebuild the FTS5 search index from existing data.
 * Runs on every startup to ensure search is available after restarts.
 */
export function rebuildFtsIndex(): void {
  logger.info('Rebuilding FTS search index...');

  // Rebuild artists
  const artists = db.prepare('SELECT id, name FROM artists').all() as { id: number; name: string }[];
  for (const artist of artists) {
    db.prepare(
      'INSERT INTO search_fts(rowid, title, artist_name, album_title) VALUES (?, ?, ?, ?)'
    ).run(ARTIST_OFFSET + artist.id, artist.name, artist.name, '');
  }

  // Rebuild albums
  const albums = db.prepare(`
    SELECT al.id, al.title, ar.name AS artist_name
    FROM albums al
    JOIN artists ar ON ar.id = al.artist_id
  `).all() as { id: number; title: string; artist_name: string }[];
  for (const album of albums) {
    db.prepare(
      'INSERT INTO search_fts(rowid, title, artist_name, album_title) VALUES (?, ?, ?, ?)'
    ).run(ALBUM_OFFSET + album.id, album.title, album.artist_name, '');
  }

  // Rebuild tracks
  const tracks = db.prepare(`
    SELECT t.id, t.title, ar.name AS artist_name, al.title AS album_title
    FROM tracks t
    JOIN artists ar ON ar.id = t.artist_id
    JOIN albums al ON al.id = t.album_id
  `).all() as { id: number; title: string; artist_name: string; album_title: string }[];
  for (const track of tracks) {
    db.prepare(
      'INSERT INTO search_fts(rowid, title, artist_name, album_title) VALUES (?, ?, ?, ?)'
    ).run(TRACK_OFFSET + track.id, track.title, track.artist_name, track.album_title);
  }

  logger.info(
    { artists: artists.length, albums: albums.length, tracks: tracks.length },
    'FTS search index rebuilt'
  );
}

function seedAdminUser(): void {
  const existingAdmin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (existingAdmin) {
    return;
  }

  const password = randomBytes(18).toString('base64url').slice(0, 24);
  const passwordHash = bcrypt.hashSync(password, 10);

  const stmt = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
  stmt.run('admin', passwordHash, 'admin');

  logger.info('Admin user created with random password (check server logs on first run)');
}

export function runMigrations(): void {
  initSchema();
  rebuildFtsIndex();
  seedAdminUser();
}

export function closeDb(): void {
  db.close();
}