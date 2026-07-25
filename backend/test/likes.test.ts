/**
 * Likes API tests (T16).
 *
 * POST /api/likes  — toggle like state
 * GET  /api/likes  — list user's liked items (optionally filtered by type)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createTestApp } from './setup.js';
import { db } from '@/db.js';
import { signToken } from '@/jwt.js';

let app: Hono;
let tokenA: string;
let tokenB: string;
const userAId = 1001;
const userBId = 1002;

// Seed: create users + minimal library data for resolved-detail joins
async function seedData(): Promise<void> {
  // Clean tables that depend on our data
  db.exec('DELETE FROM likes');
  db.exec('DELETE FROM playlist_items');
  db.exec('DELETE FROM playlists');
  db.exec('DELETE FROM tracks');
  db.exec('DELETE FROM albums');
  db.exec('DELETE FROM artists');
  db.exec('DELETE FROM users');

  // Users
  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.hashSync('pass', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(userAId, 'likesA', hash, 'user');
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(userBId, 'likesB', hash, 'user');

  // Artists (needed for track/album joins)
  db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)').run(10, 'Test Artist');

  // Albums
  db.prepare('INSERT INTO albums (id, artist_id, title, year) VALUES (?, ?, ?, ?)').run(10, 10, 'Test Album', 2024);

  // Tracks
  db.prepare('INSERT INTO tracks (id, album_id, artist_id, title, track_number, file_path, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(100, 10, 10, 'Test Track', 1, '/tmp/test/track100.mp3', 200);

  // Sign tokens
  tokenA = await signToken({ sub: String(userAId), role: 'user' });
  tokenB = await signToken({ sub: String(userBId), role: 'user' });
}

beforeAll(async () => {
  await seedData();

  const { default: likesRoutes } = await import('@/routes/likes.js');
  app = createTestApp();
  app.route('/api/likes', likesRoutes);
});

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

describe('POST /api/likes — toggle', () => {
  it('likes a track (first toggle = liked)', async () => {
    const res = await app.request('/api/likes', {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ itemType: 'track', itemId: '100' }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.liked).toBe(true);
  });

  it('unlikes on second toggle', async () => {
    const res = await app.request('/api/likes', {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ itemType: 'track', itemId: '100' }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.liked).toBe(false);
  });

  it('likes an artist', async () => {
    const res = await app.request('/api/likes', {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ itemType: 'artist', itemId: '10' }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.liked).toBe(true);
  });

  it('likes an album', async () => {
    const res = await app.request('/api/likes', {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ itemType: 'album', itemId: '10' }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.liked).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType: 'track', itemId: '100' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/likes — list', () => {
  beforeAll(async () => {
    // Ensure userA has: track 100 (liked first, then unliked — so only artist 10, album 10 remain)
    // Actually let's like track 100 again for listing test
    await app.request('/api/likes', {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ itemType: 'track', itemId: '100' }),
    });
  });

  it('returns all liked items for the user', async () => {
    const res = await app.request('/api/likes', {
      headers: authHeaders(tokenA),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(Array.isArray(body)).toBe(true);
    // Should have track 100, artist 10, album 10 (3 items)
    expect(body.length).toBe(3);
    // Each item should have itemType, itemId, createdAt
    for (const item of body) {
      expect(item).toHaveProperty('itemType');
      expect(item).toHaveProperty('itemId');
      expect(item).toHaveProperty('createdAt');
    }
  });

  it('filters by itemType=track', async () => {
    const res = await app.request('/api/likes?itemType=track', {
      headers: authHeaders(tokenA),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBe(1);
    expect(body[0].itemType).toBe('track');
  });

  it('returns empty list for other user (isolation)', async () => {
    const res = await app.request('/api/likes', {
      headers: authHeaders(tokenB),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(body.length).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/likes');
    expect(res.status).toBe(401);
  });
});
