/**
 * Role detection tests (T12).
 *
 * GET /api/source/info returns different payloads based on ROLE:
 * - source: { isSource: true, hasMusicDir: bool, musicDir: string }
 * - player: { isSource: false }
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createTestApp } from './setup.js';
import { env } from '@/env.js';

describe('GET /api/source/info — source role', () => {
  let app: Hono;

  beforeAll(async () => {
    // env.role is already 'source' from vitest config
    // Ensure musicDir is set
    const { default: sourceInfoRoutes } = await import('@/routes/sourceInfo.js');
    app = createTestApp();
    app.route('/api/source', sourceInfoRoutes);
  });

  it('returns isSource: true for source role', async () => {
    const res = await app.request('/api/source/info');
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.isSource).toBe(true);
  });

  it('returns hasMusicDir as boolean', async () => {
    const res = await app.request('/api/source/info');
    const body: any = await res.json();
    expect(typeof body.hasMusicDir).toBe('boolean');
  });

  it('returns musicDir string when hasMusicDir is true', async () => {
    const res = await app.request('/api/source/info');
    const body: any = await res.json();
    if (body.hasMusicDir) {
      expect(typeof body.musicDir).toBe('string');
      expect(body.musicDir!.length).toBeGreaterThan(0);
    }
  });
});

describe('GET /api/source/info — player role', () => {
  let app: Hono;

  beforeAll(async () => {
    // Set role to player for this test group
    env.role = 'player' as any;

    const { default: sourceInfoRoutes } = await import('@/routes/sourceInfo.js');
    app = createTestApp();
    app.route('/api/source', sourceInfoRoutes);
  });

  afterAll(() => {
    // Restore for other tests
    env.role = 'source' as any;
  });

  it('returns isSource: false for player role', async () => {
    const res = await app.request('/api/source/info');
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.isSource).toBe(false);
    expect(body.hasMusicDir).toBeUndefined();
    expect(body.musicDir).toBeUndefined();
  });
});
