import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createTestApp } from './setup.js';

let app: Hono;

// The CORS middleware is already mounted in createTestApp via setup.ts.
// We create a minimal endpoint to inspect response headers.
async function getApp(): Promise<Hono> {
  if (!app) {
    app = createTestApp();
    app.get('/test', (c) => c.json({ ok: true }));
  }
  return app;
}

describe('CORS middleware', () => {
  it('sets Allow-Origin to request Origin + Credentials + Vary when Origin present', async () => {
    const a = await getApp();
    const res = await a.request('/test', {
      method: 'GET',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  it('sets NO Allow-Origin and NO Allow-Credentials when no Origin header (non-cross-origin)', async () => {
    const a = await getApp();
    const res = await a.request('/test', { method: 'GET' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(res.headers.has('Access-Control-Allow-Credentials')).toBe(false);
  });

  it('player route with SOURCE_URL set returns credentials + vary (Fix H1)', async () => {
    const prevSourceUrl = process.env.SOURCE_URL;
    process.env.SOURCE_URL = 'http://localhost:5173';
    try {
      const a = new Hono();
      // Create a fresh app so getAllowedOriginForPlayer picks up the new SOURCE_URL
      // We need the CORS middleware mounted, then a player route
      const { corsMiddleware } = await import('@/cors.js');
      a.use('*', corsMiddleware());
      a.get('/api/player/test', (c) => c.json({ ok: true }));

      const res = await a.request('/api/player/test', {
        method: 'GET',
        headers: { Origin: 'http://localhost:5173' },
      });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(res.headers.get('Vary')).toBe('Origin');
    } finally {
      process.env.SOURCE_URL = prevSourceUrl;
    }
  });

  it('returns 200 for OPTIONS preflight with all required headers', async () => {
    const a = await getApp();
    const res = await a.request('/test', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Requested-With');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Range');
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('Content-Range');
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('Accept-Ranges');
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('Content-Length');
  });
});
