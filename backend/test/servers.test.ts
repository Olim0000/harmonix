/**
 * Servers API tests (T18).
 *
 * GET    /api/servers       — list user's servers
 * POST   /api/servers       — create server (validates name, host, port)
 * PUT    /api/servers/:id   — update server fields
 * DELETE /api/servers/:id   — delete server
 *
 * All per-user scoped. JWT-protected.
 * Native Main Server (id=0) is a frontend-only construct — not stored in DB.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createTestApp } from './setup.js';
import { db } from '@/db.js';
import { signToken } from '@/jwt.js';

let app: Hono;
let token: string;
let otherToken: string;
const userId = 3001;
const otherUserId = 3002;

async function seedData(): Promise<void> {
  // Clean servers table + dependent data
  db.exec('DELETE FROM servers');
  db.exec('DELETE FROM playlist_items');
  db.exec('DELETE FROM playlists');
  db.exec('DELETE FROM likes');
  db.exec('DELETE FROM tracks');
  db.exec('DELETE FROM albums');
  db.exec('DELETE FROM artists');
  db.exec('DELETE FROM users');

  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.hashSync('pass', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(userId, 'serverUser', hash, 'user');
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(otherUserId, 'otherUser', hash, 'user');

  token = await signToken({ sub: String(userId), role: 'user' });
  otherToken = await signToken({ sub: String(otherUserId), role: 'user' });
}

beforeAll(async () => {
  await seedData();

  const { default: serversRoutes } = await import('@/routes/servers.js');
  app = createTestApp();
  app.route('/api/servers', serversRoutes);
});

function auth(t: string): Record<string, string> {
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}

describe('GET /api/servers — list', () => {
  it('returns empty list initially', async () => {
    const res = await app.request('/api/servers', { headers: auth(token) });
    expect(res.status).toBe(200);
    const body = await res.json() as any[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });
});

describe('POST /api/servers', () => {
  it('creates a server and returns id, name, host, port, createdAt', async () => {
    const res = await app.request('/api/servers', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'My Server', host: '192.168.1.100', port: 6600 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.id).toBeGreaterThan(0);
    expect(body.name).toBe('My Server');
    expect(body.host).toBe('192.168.1.100');
    expect(body.port).toBe(6600);
    expect(body.createdAt).toBeTruthy();
  });

  it('rejects empty name with 400', async () => {
    const res = await app.request('/api/servers', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: '', host: 'localhost', port: 8080 }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects empty host with 400', async () => {
    const res = await app.request('/api/servers', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Test', host: '', port: 8080 }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects port 0 with 400', async () => {
    const res = await app.request('/api/servers', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Test', host: 'localhost', port: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects port 65536 with 400', async () => {
    const res = await app.request('/api/servers', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Test', host: 'localhost', port: 65536 }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects negative port with 400', async () => {
    const res = await app.request('/api/servers', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Test', host: 'localhost', port: -1 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await app.request('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Auth', host: 'localhost', port: 8080 }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/servers — list after create', () => {
  it('returns created server in list', async () => {
    const res = await app.request('/api/servers', { headers: auth(token) });
    const body = await res.json() as any[];
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('name');
    expect(body[0]).toHaveProperty('host');
    expect(body[0]).toHaveProperty('port');
    expect(body[0]).toHaveProperty('createdAt');
  });

  it('does not include other user\'s servers', async () => {
    const res = await app.request('/api/servers', { headers: auth(otherToken) });
    const body = await res.json() as any[];
    expect(body.length).toBe(0);
  });
});

describe('PUT /api/servers/:id — update', () => {
  let serverId: number;

  beforeAll(async () => {
    const res = await app.request('/api/servers', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Update Me', host: '10.0.0.1', port: 8000 }),
    });
    const body: any = await res.json();
    serverId = body.id;
  });

  it('updates all fields', async () => {
    const res = await app.request(`/api/servers/${serverId}`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ name: 'Updated', host: '10.0.0.2', port: 9000 }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.name).toBe('Updated');
    expect(body.host).toBe('10.0.0.2');
    expect(body.port).toBe(9000);
  });

  it('updates partial fields', async () => {
    const res = await app.request(`/api/servers/${serverId}`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ name: 'Partially Updated' }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.name).toBe('Partially Updated');
    // Other fields unchanged
    expect(body.host).toBe('10.0.0.2');
    expect(body.port).toBe(9000);
  });

  it('returns 404 for other user\'s server', async () => {
    const res = await app.request(`/api/servers/${serverId}`, {
      method: 'PUT',
      headers: auth(otherToken),
      body: JSON.stringify({ name: 'Hack Attempt' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent server', async () => {
    const res = await app.request('/api/servers/99999', {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ name: 'Nope' }),
    });
    expect(res.status).toBe(404);
  });

  it('validates port on update', async () => {
    const res = await app.request(`/api/servers/${serverId}`, {
      method: 'PUT',
      headers: auth(token),
      body: JSON.stringify({ port: 70000 }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/servers/:id — delete', () => {
  let serverId: number;

  beforeAll(async () => {
    const res = await app.request('/api/servers', {
      method: 'POST',
      headers: auth(token),
      body: JSON.stringify({ name: 'Delete Me', host: '10.0.0.3', port: 7000 }),
    });
    const body: any = await res.json();
    serverId = body.id;
  });

  it('deletes own server', async () => {
    const res = await app.request(`/api/servers/${serverId}`, {
      method: 'DELETE',
      headers: auth(token),
    });
    expect(res.status).toBe(200);
  });

  it('returns 404 for deleted server', async () => {
    const res = await app.request(`/api/servers/${serverId}`, {
      headers: auth(token),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 for other user\'s server', async () => {
    // Create another user's server
    const createRes = await app.request('/api/servers', {
      method: 'POST',
      headers: auth(otherToken),
      body: JSON.stringify({ name: 'Other Server', host: '10.0.0.4', port: 7001 }),
    });
    const body: any = await createRes.json();

    const res = await app.request(`/api/servers/${body.id}`, {
      method: 'DELETE',
      headers: auth(token),
    });
    expect(res.status).toBe(404);
  });
});
