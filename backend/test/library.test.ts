import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createTestApp } from './setup.js';
import { db } from '@/db.js';
import { authMiddleware } from '@/auth.js';

let app: Hono;

beforeAll(async () => {
  // Clean and seed data (FTS5 cleanup handled by after_delete triggers)
  db.exec('DELETE FROM tracks');
  db.exec('DELETE FROM albums');
  db.exec('DELETE FROM artists');
  db.exec('DELETE FROM users');

  // Seed 2 artists
  db.prepare('INSERT INTO artists (id, name, sort_name) VALUES (?, ?, ?)').run(1, 'Artist One', 'One, Artist');
  db.prepare('INSERT INTO artists (id, name, sort_name) VALUES (?, ?, ?)').run(2, 'Artist Two', 'Two, Artist');

  // Seed 3 albums
  db.prepare('INSERT INTO albums (id, artist_id, title, year) VALUES (?, ?, ?, ?)').run(1, 1, 'Album One', 2020);
  db.prepare('INSERT INTO albums (id, artist_id, title, year) VALUES (?, ?, ?, ?)').run(2, 1, 'Album Two', 2021);
  db.prepare('INSERT INTO albums (id, artist_id, title, year) VALUES (?, ?, ?, ?)').run(3, 2, 'Album Three', 2022);

  // Seed 10 tracks
  for (let i = 1; i <= 10; i++) {
    const albumId = i <= 5 ? 1 : i <= 8 ? 2 : 3;
    const artistId = albumId <= 2 ? 1 : 2;
    db.prepare(
      'INSERT INTO tracks (id, album_id, artist_id, title, track_number, file_path, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(i, albumId, artistId, `Track ${i}`, i, `/tmp/test/track${i}.mp3`, 200 + i);
  }

  // Create a user and sign a token for authenticated requests
  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.hashSync('testpass', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(999, 'librarytest', hash, 'user');

  const { signToken } = await import('@/jwt.js');
  const token = await signToken({ sub: '999', role: 'user' });

  // Build app with auth middleware on library routes
  const { default: libraryRoutes } = await import('@/routes/library.js');
  app = createTestApp();
  app.use('/api/*', authMiddleware);
  app.route('/api', libraryRoutes);

  // Store token for tests to use
  (globalThis as any).__libraryToken = token;
});

function getToken(): string {
  return (globalThis as any).__libraryToken;
}

describe('GET /api/artists', () => {
  it('returns all artists with album_count', async () => {
    const res = await app.request('/api/artists', {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBe(2);
    expect(body[0].name).toBeTruthy();
    expect(body[0].album_count).toBeTypeOf('number');
    const one = body.find((a: any) => a.id === 1);
    expect(one.album_count).toBe(2);
    const two = body.find((a: any) => a.id === 2);
    expect(two.album_count).toBe(1);
  });
});

describe('GET /api/artists/:id', () => {
  it('returns artist with albums array', async () => {
    const res = await app.request('/api/artists/1', {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.artist).toBeTruthy();
    expect(body.artist.name).toBe('Artist One');
    expect(body.albums).toBeInstanceOf(Array);
    expect(body.albums.length).toBe(2);
    expect(body.albums[0].title).toBeTruthy();
    expect(body.albums[0].track_count).toBeTypeOf('number');
  });

  it('returns 404 for non-existent artist', async () => {
    const res = await app.request('/api/artists/999', {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/albums', () => {
  it('returns all albums with artist_name and track_count', async () => {
    const res = await app.request('/api/albums', {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any[];
    expect(body.length).toBe(3);
    expect(body[0].artist_name).toBeTruthy();
    expect(body[0].track_count).toBeTypeOf('number');
    const album1 = body.find((a: any) => a.id === 1);
    expect(album1.track_count).toBe(5);
    expect(album1.artist_name).toBe('Artist One');
  });
});

describe('GET /api/albums/:id', () => {
  it('returns album with tracks array', async () => {
    const res = await app.request('/api/albums/1', {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.album).toBeTruthy();
    expect(body.album.title).toBe('Album One');
    expect(body.tracks).toBeInstanceOf(Array);
    expect(body.tracks.length).toBe(5);
    expect(body.tracks[0].title).toBeTruthy();
  });

  it('returns 404 for non-existent album', async () => {
    const res = await app.request('/api/albums/999', {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/tracks/:id', () => {
  it('returns a single track with artist_name and album_title', async () => {
    const res = await app.request('/api/tracks/1', {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.track).toBeTruthy();
    expect(body.track.title).toBe('Track 1');
    expect(body.track.artist_name).toBe('Artist One');
    expect(body.track.album_title).toBe('Album One');
  });

  it('returns 404 for non-existent track', async () => {
    const res = await app.request('/api/tracks/999', {
      method: 'GET',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    expect(res.status).toBe(404);
  });
});

describe('auth requirement', () => {
  it('returns 401 for /api/artists without auth', async () => {
    const res = await app.request('/api/artists', { method: 'GET' });
    expect(res.status).toBe(401);
  });
});
