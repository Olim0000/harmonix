/**
 * Playlists API tests (T17).
 *
 * POST   /api/playlists              — create playlist
 * GET    /api/playlists              — list user's playlists with trackCount
 * GET    /api/playlists/:id          — get playlist with tracks
 * POST   /api/playlists/:id/tracks   — add track (duplicate → 409)
 * DELETE /api/playlists/:id/tracks/:trackId — remove track, compact positions
 * PUT    /api/playlists/:id/reorder  — reorder tracks (validates permutation)
 * DELETE /api/playlists/:id          — delete playlist (cascade)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createTestApp } from './setup.js';
import { db } from '@/db.js';
import { signToken } from '@/jwt.js';

let app: Hono;
let token: string;
let otherToken: string;
const userId = 2001;
const otherUserId = 2002;

async function seedData(): Promise<void> {
  // Clean tables that depend on our data
  db.exec('DELETE FROM playlist_items');
  db.exec('DELETE FROM playlists');
  db.exec('DELETE FROM likes');
  db.exec('DELETE FROM tracks');
  db.exec('DELETE FROM albums');
  db.exec('DELETE FROM artists');
  db.exec('DELETE FROM users');

  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.hashSync('pass', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(userId, 'playlistUser', hash, 'user');
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(otherUserId, 'otherUser', hash, 'user');

  // Seed artists + albums + tracks for playlists
  db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)').run(20, 'Playlist Artist');
  db.prepare('INSERT INTO albums (id, artist_id, title, year) VALUES (?, ?, ?, ?)').run(20, 20, 'Playlist Album', 2024);

  for (let i = 1; i <= 5; i++) {
    db.prepare(
      'INSERT INTO tracks (id, album_id, artist_id, title, track_number, file_path, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(200 + i, 20, 20, `Playlist Track ${i}`, i, `/tmp/test/playlist_track_${i}.mp3`, 200 + i);
  }

  token = await signToken({ sub: String(userId), role: 'user' });
  otherToken = await signToken({ sub: String(otherUserId), role: 'user' });
}

beforeAll(async () => {
  await seedData();

  const { default: playlistsRoutes } = await import('@/routes/playlists.js');
  app = createTestApp();
  app.route('/api/playlists', playlistsRoutes);
});

function auth(t: string): Record<string, string> {
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}

describe('POST /api/playlists — create', () => {
  it('creates a playlist and returns id, name, createdAt', async () => {
    const res = await app.request('/api/playlists', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'My Favorites' }),
    });
    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.id).toBeGreaterThan(0);
    expect(body.name).toBe('My Favorites');
    expect(body.createdAt).toBeTruthy();
  });

  it('rejects empty name with 400', async () => {
    const res = await app.request('/api/playlists', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('allows duplicate names (per-user non-unique)', async () => {
    const res = await app.request('/api/playlists', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'My Favorites' }),
    });
    expect(res.status).toBe(201);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Auth' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/playlists — list', () => {
  it('returns list of playlists with trackCount', async () => {
    const res = await app.request('/api/playlists', {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    for (const pl of body) {
      expect(pl).toHaveProperty('id');
      expect(pl).toHaveProperty('name');
      expect(pl).toHaveProperty('trackCount');
      expect(pl).toHaveProperty('createdAt');
    }
  });
});

describe('GET /api/playlists/:id — get one', () => {
  let playlistId: number;

  beforeAll(async () => {
    // Create a fresh playlist and add some tracks
    const createRes = await app.request('/api/playlists', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Detail Test' }),
    });
    const pl: any = await createRes.json();
    playlistId = pl.id;

    // Add 3 tracks
    for (const tid of [201, 202, 203]) {
      await app.request(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: auth(token),
        body: JSON.stringify({ trackId: tid }),
      });
    }
  });

  it('returns playlist with tracks including resolved fields', async () => {
    const res = await app.request(`/api/playlists/${playlistId}`, {
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.id).toBe(playlistId);
    expect(body.name).toBe('Detail Test');
    expect(Array.isArray(body.tracks)).toBe(true);
    expect(body.tracks.length).toBe(3);
    for (const t of body.tracks) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('title');
      expect(t).toHaveProperty('artist');
      expect(t).toHaveProperty('album');
      expect(t).toHaveProperty('duration');
      expect(t).toHaveProperty('position');
    }
  });

  it('returns 404 for another user\'s playlist', async () => {
    const res = await app.request(`/api/playlists/${playlistId}`, {
      headers: auth(otherToken),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent playlist', async () => {
    const res = await app.request('/api/playlists/99999', {
      headers: auth(token),
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/playlists/:id/tracks — add track', () => {
  let playlistId: number;

  beforeAll(async () => {
    const res = await app.request('/api/playlists', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Add Tracks Test' }),
    });
    const pl: any = await res.json();
    playlistId = pl.id;
  });

  it('adds a track and returns position', async () => {
    const res = await app.request(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ trackId: 201 }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toHaveProperty('position');
    expect(typeof body.position).toBe('number');
  });

  it('returns 409 for duplicate track', async () => {
    const res = await app.request(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ trackId: 201 }),
    });
    expect(res.status).toBe(409);
    const body: any = await res.json();
    expect(body.error).toBe('Already in playlist');
  });

  it('returns 404 for non-existent playlist', async () => {
    const res = await app.request('/api/playlists/99999/tracks', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ trackId: 202 }),
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/playlists/:id/tracks/:trackId — remove track', () => {
  let playlistId: number;
  let firstTrackId = 202;
  let secondTrackId = 203;

  beforeAll(async () => {
    const res = await app.request('/api/playlists', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Remove Track Test' }),
    });
    const pl: any = await res.json();
    playlistId = pl.id;

    // Add 3 tracks in order
    await app.request(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST', headers: auth(token), body: JSON.stringify({ trackId: 201 }),
    });
    await app.request(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST', headers: auth(token), body: JSON.stringify({ trackId: 202 }),
    });
    await app.request(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST', headers: auth(token), body: JSON.stringify({ trackId: 203 }),
    });
  });

  it('removes the middle track and compacts positions', async () => {
    // Remove track 202 (position 1 in 0-based)
    const res = await app.request(
      `/api/playlists/${playlistId}/tracks/${secondTrackId}`,
      { method: 'DELETE', headers: auth(token) }
    );
    expect(res.status).toBe(200);

    // Check remaining tracks — should be 2 tracks with positions 0,1
    const detailRes = await app.request(`/api/playlists/${playlistId}`, {
      headers: auth(token),
    });
    const body: any = await detailRes.json();
    expect(body.tracks.length).toBe(2);
    // Positions should be compacted (no gaps)
    const positions = body.tracks.map((t: any) => t.position).sort();
    expect(positions).toEqual([0, 1]);
  });

  it('returns 404 for already removed track', async () => {
    const res = await app.request(
      `/api/playlists/${playlistId}/tracks/${secondTrackId}`,
      { method: 'DELETE', headers: auth(token) }
    );
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/playlists/:id/reorder — reorder', () => {
  let playlistId: number;

  beforeAll(async () => {
    const res = await app.request('/api/playlists', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Reorder Test' }),
    });
    const pl: any = await res.json();
    playlistId = pl.id;

    // Add 4 tracks
    for (const tid of [201, 202, 203, 204]) {
      await app.request(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST', headers: auth(token), body: JSON.stringify({ trackId: tid }),
      });
    }
  });

  it('reorders tracks correctly', async () => {
    const res = await app.request(`/api/playlists/${playlistId}/reorder`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ trackIds: [204, 203, 202, 201] }),
    });
    expect(res.status).toBe(200);

    // Verify order
    const detailRes = await app.request(`/api/playlists/${playlistId}`, {
      headers: auth(token),
    });
    const body: any = await detailRes.json();
    expect(body.tracks.map((t: any) => t.id)).toEqual([204, 203, 202, 201]);
  });

  it('returns 400 for invalid permutation (extra id)', async () => {
    const res = await app.request(`/api/playlists/${playlistId}/reorder`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ trackIds: [201, 202, 203, 204, 999] }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid permutation (missing id)', async () => {
    const res = await app.request(`/api/playlists/${playlistId}/reorder`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ trackIds: [201, 202, 203] }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for duplicate ids in permutation', async () => {
    const res = await app.request(`/api/playlists/${playlistId}/reorder`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ trackIds: [201, 201, 202, 203] }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/playlists/:id — delete playlist', () => {
  let playlistId: number;

  beforeAll(async () => {
    const res = await app.request('/api/playlists', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'To Delete' }),
    });
    const pl: any = await res.json();
    playlistId = pl.id;

    // Add a track
    await app.request(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST', headers: auth(token), body: JSON.stringify({ trackId: 205 }),
    });
  });

  it('deletes playlist', async () => {
    const res = await app.request(`/api/playlists/${playlistId}`, {
      method: 'DELETE',
      headers: auth(token),
    });
    expect(res.status).toBe(200);
  });

  it('deleted playlist returns 404', async () => {
    const res = await app.request(`/api/playlists/${playlistId}`, {
      headers: auth(token),
    });
    expect(res.status).toBe(404);
  });

  it('cascade: playlist_items are gone', async () => {
    const items = db.prepare('SELECT * FROM playlist_items WHERE playlist_id = ?').all(playlistId);
    expect(items.length).toBe(0);
  });

  it('returns 404 for another user\'s playlist', async () => {
    // Create a playlist as the other user
    const createRes = await app.request('/api/playlists', {
      method: 'POST',
      headers: auth(otherToken),
      body: JSON.stringify({ name: 'Other User Playlist' }),
    });
    const pl: any = await createRes.json();
    const otherPlaylistId = pl.id;

    // Try to delete as main user
    const res = await app.request(`/api/playlists/${otherPlaylistId}`, {
      method: 'DELETE',
      headers: auth(token),
    });
    expect(res.status).toBe(404);
  });
});
