import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createTestApp } from './setup.js';
import { db } from '@/db.js';
import { env } from '@/env.js';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

let app: Hono;

beforeAll(async () => {
  // Clean and seed data (FTS5 cleanup handled by after_delete triggers)
  db.exec('DELETE FROM tracks');
  db.exec('DELETE FROM albums');
  db.exec('DELETE FROM artists');

  // Create a test audio file inside musicDir so the path-containment check passes
  const musicDir = env.musicDir!;
  if (!existsSync(musicDir)) {
    mkdirSync(musicDir, { recursive: true });
  }
  const audioFixturePath = join(musicDir, 'audio.mp3');
  if (!existsSync(audioFixturePath)) {
    writeFileSync(audioFixturePath, Buffer.alloc(1024)); // 1KB of zeros
  }

  db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)').run(1, 'Test Artist');
  db.prepare('INSERT INTO albums (id, artist_id, title) VALUES (?, ?, ?)').run(1, 1, 'Test Album');
  // Store relative path from musicDir — containment check will resolve it correctly
  db.prepare(
    'INSERT INTO tracks (id, album_id, artist_id, title, track_number, file_path, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(1, 1, 1, 'Test Track', 1, 'audio.mp3', 30);

  const { default: streamRoutes } = await import('@/routes/stream.js');
  app = createTestApp();
  app.route('/api/stream', streamRoutes);
});

describe('GET /api/stream/:trackId', () => {
  it('returns 200 full file when no Range header', async () => {
    const res = await app.request('/api/stream/1');
    expect(res.status).toBe(200);
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBe(1024);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
  });

  it('returns 206 with Content-Range for bytes=0-99', async () => {
    const res = await app.request('/api/stream/1', {
      method: 'GET',
      headers: { Range: 'bytes=0-99' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-99/1024');
    expect(res.headers.get('Content-Length')).toBe('100');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBe(100);
  });

  it('returns 206 for bytes=100- (open-ended)', async () => {
    const res = await app.request('/api/stream/1', {
      method: 'GET',
      headers: { Range: 'bytes=100-' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 100-1023/1024');
    // Content-Length should be 924 (1024 - 100)
    expect(res.headers.get('Content-Length')).toBe('924');
  });

  it('returns 416 for bytes=999- when fileSize=1024 (start > 1023)', async () => {
    const res = await app.request('/api/stream/1', {
      method: 'GET',
      headers: { Range: 'bytes=2000-' },
    });
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */1024');
  });

  it('returns 404 for missing track', async () => {
    const res = await app.request('/api/stream/999');
    expect(res.status).toBe(404);
  });

  it('returns 404 when track file does not exist', async () => {
    db.prepare(
      'INSERT INTO tracks (id, album_id, artist_id, title, track_number, file_path, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(2, 1, 1, 'Missing File', 2, '/nonexistent/file.mp3', 30);

    const res = await app.request('/api/stream/2');
    expect(res.status).toBe(404);
  });

  it('returns 404 for path traversal attempt via file_path', async () => {
    db.prepare(
      'INSERT INTO tracks (id, album_id, artist_id, title, track_number, file_path, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(3, 1, 1, 'Path Traversal', 3, '../../../../etc/passwd', 30);

    const res = await app.request('/api/stream/3');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/stream/:trackId — suffix range', () => {
  it('returns 206 for bytes=-500 (last 500 bytes)', async () => {
    const res = await app.request('/api/stream/1', {
      method: 'GET',
      headers: { Range: 'bytes=-500' },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 524-1023/1024');
    expect(res.headers.get('Content-Length')).toBe('500');
  });
});
