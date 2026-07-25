import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createTestApp } from './setup.js';
import { db } from '@/db.js';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

let app: Hono;

beforeAll(async () => {
  // Clean and seed artists with/without image_path
  db.exec('DELETE FROM tracks');
  db.exec('DELETE FROM albums');
  db.exec('DELETE FROM artists');
  db.exec('DELETE FROM sqlite_sequence'); // reset autoincrement for clean IDs

  // Create a real cover image file for testing
  const coversDir = '/tmp/harmonix-test-covers';
  if (!existsSync(coversDir)) {
    mkdirSync(coversDir, { recursive: true });
  }
  // Write a minimal PNG (1x1 pixel) as cover test file
  // Minimal valid PNG: 8-byte signature + IHDR + IDAT + IEND
  const minimalPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, etc + CRC
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
    0x00, 0x05, 0xFE, 0x02, 0xFE, 0x07, 0x00, 0x00, // ... compressed data
    0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82, // IEND
  ]);
  const coverPath = join(coversDir, 'test_artist_cover.png');
  writeFileSync(coverPath, minimalPng);

  db.prepare('INSERT INTO artists (id, name, image_path) VALUES (?, ?, ?)').run(1, 'Artist With Cover', coverPath);
  db.prepare('INSERT INTO artists (id, name, image_path) VALUES (?, ?, ?)').run(2, 'Artist No Cover', null);
  db.prepare('INSERT INTO artists (id, name, image_path) VALUES (?, ?, ?)').run(3, 'Artist Missing File', '/tmp/harmonix-test-covers/nonexistent.png');
  db.prepare('INSERT INTO artists (id, name, image_path) VALUES (?, ?, ?)').run(4, 'Artist Path Traversal', '../../../etc/passwd');

  db.prepare('INSERT INTO albums (id, artist_id, title, cover_path) VALUES (?, ?, ?, ?)').run(1, 1, 'Album With Cover', coverPath);
  db.prepare('INSERT INTO albums (id, artist_id, title, cover_path) VALUES (?, ?, ?, ?)').run(2, 1, 'Album No Cover', null);

  const { default: coversRoutes } = await import('@/routes/covers.js');
  app = createTestApp();
  app.route('/api/covers', coversRoutes);
});

describe('GET /api/covers/artist/:id', () => {
  it('returns 200 with correct Content-Type when image_path exists and file present', async () => {
    const res = await app.request('/api/covers/artist/1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it('returns 200 with image/svg+xml placeholder when image_path is null', async () => {
    const res = await app.request('/api/covers/artist/2');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    const body = await res.text();
    expect(body).toContain('<svg');
  });

  it('returns 200 with SVG placeholder when image file is missing', async () => {
    const res = await app.request('/api/covers/artist/3');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
  });

  it('returns 200 with SVG placeholder for path traversal attempt', async () => {
    const res = await app.request('/api/covers/artist/4');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
  });

  it('returns 200 with SVG placeholder for non-existent artist', async () => {
    const res = await app.request('/api/covers/artist/999');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
  });
});

describe('GET /api/covers/album/:id', () => {
  it('returns 200 with correct Content-Type when cover_path exists and file present', async () => {
    const res = await app.request('/api/covers/album/1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns 200 with SVG placeholder when cover_path is null', async () => {
    const res = await app.request('/api/covers/album/2');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
  });

  it('returns 200 with SVG placeholder for non-existent album', async () => {
    const res = await app.request('/api/covers/album/999');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
  });
});
