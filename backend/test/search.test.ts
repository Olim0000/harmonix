import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createTestApp } from './setup.js';
import { db, ftsRowid } from '@/db.js';

let app: Hono;

beforeAll(async () => {
  // Clean and seed data
  // Delete in order: tracks first (no FK dependencies), then albums, then artists
  // FTS5 cleanup happens via after_delete triggers
  db.exec('DELETE FROM tracks');
  db.exec('DELETE FROM albums');
  db.exec('DELETE FROM artists');

  // Seed 2 artists
  db.prepare('INSERT INTO artists (id, name, sort_name) VALUES (?, ?, ?)').run(1, 'The Beatles', 'Beatles, The');
  db.prepare('INSERT INTO artists (id, name, sort_name) VALUES (?, ?, ?)').run(2, 'Led Zeppelin', 'Zeppelin, Led');

  // Seed 3 albums
  db.prepare('INSERT INTO albums (id, artist_id, title, year) VALUES (?, ?, ?, ?)').run(1, 1, 'Abbey Road', 1969);
  db.prepare('INSERT INTO albums (id, artist_id, title, year) VALUES (?, ?, ?, ?)').run(2, 1, 'Sgt. Pepper', 1967);
  db.prepare('INSERT INTO albums (id, artist_id, title, year) VALUES (?, ?, ?, ?)').run(3, 2, 'Led Zeppelin IV', 1971);

  // Seed 10 tracks
  const tracks = [
    { id: 1, album_id: 1, artist_id: 1, title: 'Come Together', track_number: 1, file_path: '/tmp/test/come_together.mp3', duration_seconds: 259 },
    { id: 2, album_id: 1, artist_id: 1, title: 'Something', track_number: 2, file_path: '/tmp/test/something.mp3', duration_seconds: 182 },
    { id: 3, album_id: 1, artist_id: 1, title: 'Maxwell Silver Hammer', track_number: 3, file_path: '/tmp/test/maxwell.mp3', duration_seconds: 207 },
    { id: 4, album_id: 1, artist_id: 1, title: 'Oh! Darling', track_number: 4, file_path: '/tmp/test/oh_darling.mp3', duration_seconds: 208 },
    { id: 5, album_id: 1, artist_id: 1, title: 'Octopus Garden', track_number: 5, file_path: '/tmp/test/octopus.mp3', duration_seconds: 171 },
    { id: 6, album_id: 3, artist_id: 2, title: 'Black Dog', track_number: 1, file_path: '/tmp/test/black_dog.mp3', duration_seconds: 295 },
    { id: 7, album_id: 3, artist_id: 2, title: 'Rock and Roll', track_number: 2, file_path: '/tmp/test/rock_roll.mp3', duration_seconds: 221 },
    { id: 8, album_id: 3, artist_id: 2, title: 'The Battle of Evermore', track_number: 3, file_path: '/tmp/test/evermore.mp3', duration_seconds: 355 },
    { id: 9, album_id: 3, artist_id: 2, title: 'Stairway to Heaven', track_number: 4, file_path: '/tmp/test/stairway.mp3', duration_seconds: 482 },
    { id: 10, album_id: 3, artist_id: 2, title: 'Misty Mountain Hop', track_number: 5, file_path: '/tmp/test/misty.mp3', duration_seconds: 278 },
  ];

  const insertTrack = db.prepare(
    'INSERT INTO tracks (id, album_id, artist_id, title, track_number, file_path, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const t of tracks) {
    insertTrack.run(t.id, t.album_id, t.artist_id, t.title, t.track_number, t.file_path, t.duration_seconds);
  }

  // Manually seed FTS5 since triggers may not fire for autoincrement IDs with explicit IDs
  const ftsInsert = db.prepare('INSERT OR IGNORE INTO search_fts(rowid, title, artist_name, album_title) VALUES (?, ?, ?, ?)');
  ftsInsert.run(ftsRowid('artist', 1), 'The Beatles', 'The Beatles', '');
  ftsInsert.run(ftsRowid('artist', 2), 'Led Zeppelin', 'Led Zeppelin', '');
  ftsInsert.run(ftsRowid('album', 1), 'Abbey Road', 'The Beatles', '');
  ftsInsert.run(ftsRowid('album', 2), 'Sgt. Pepper', 'The Beatles', '');
  ftsInsert.run(ftsRowid('album', 3), 'Led Zeppelin IV', 'Led Zeppelin', '');
  for (const t of tracks) {
    const artistName = t.artist_id === 1 ? 'The Beatles' : 'Led Zeppelin';
    const albumTitle = t.album_id === 1 ? 'Abbey Road' : t.album_id === 2 ? 'Sgt. Pepper' : 'Led Zeppelin IV';
    ftsInsert.run(ftsRowid('track', t.id), t.title, artistName, albumTitle);
  }

  const { default: searchRoutes } = await import('@/routes/search.js');
  app = createTestApp();
  app.route('/api', searchRoutes);
});

describe('GET /api/search', () => {
  it('returns empty array for empty query', async () => {
    const res = await app.request('/api/search?q=');
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toEqual([]);
  });

  it('returns combined results type-tagged for a matching query', async () => {
    const res = await app.request('/api/search?q=beatles');
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect((body as any[]).length).toBeGreaterThan(0);
    expect(body.length).toBeLessThanOrEqual(30);
    const artists = body.filter((r: any) => r.type === 'artist');
    expect(artists.length).toBeGreaterThanOrEqual(1);
    expect(artists[0].title).toBe('The Beatles');
  });

  it('returns track results with artist_name and album_title', async () => {
    const res = await app.request('/api/search?q=stairway');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBeGreaterThan(0);
    const track = body.find((r: any) => r.type === 'track');
    expect(track).toBeTruthy();
    expect(track.artist_name).toBe('Led Zeppelin');
    expect(track.album_title).toBe('Led Zeppelin IV');
    expect(track.duration_seconds).toBeDefined();
  });

  it('returns ≤30 results', async () => {
    const res = await app.request('/api/search?q=a');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBeLessThanOrEqual(30);
  });

  it('returns empty array for no match', async () => {
    const res = await app.request('/api/search?q=zzzznonexistent');
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body).toEqual([]);
  });
});
