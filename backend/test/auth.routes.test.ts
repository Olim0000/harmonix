import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { createTestApp, createTestDb, closeTestDb } from './setup.js';
import { db } from '@/db.js';

// Clean up users table before these tests
beforeAll(() => {
  db.exec('DELETE FROM users');
});

let app: Hono;

beforeAll(async () => {
  const { authMiddleware } = await import('@/auth.js');
  const { default: authRoutes, meHandler } = await import('@/routes/auth.js');

  app = createTestApp();
  app.route('/api/auth', authRoutes);
  app.get('/api/me', authMiddleware, meHandler);
});

describe('POST /api/auth/register', () => {
  it('registers a new user and returns token + user', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'test1234' }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user).toBeTruthy();
    expect(body.user.username).toBe('testuser');
    expect(body.user.role).toBe('user');
    expect(body.user.id).toBeDefined();
  });

  it('returns 409 for duplicate username', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'test1234' }),
    });
    expect(res.status).toBe(409);
    const body: any = await res.json();
    expect(body.error).toBe('Username taken');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'test1234' }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user).toBeTruthy();
    expect(body.user.username).toBe('testuser');
  });

  it('returns 401 for wrong password', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'wrongpassword' }),
    });
    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.error).toBe('Invalid credentials');
  });

  it('returns 401 for non-existent user', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody', password: 'test1234' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/me', () => {
  let token: string;

  beforeAll(async () => {
    db.exec('DELETE FROM users');
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'meuser', password: 'test1234' }),
    });
    const body: any = await res.json();
    token = body.token;
  });

  it('returns current user with valid token', async () => {
    const res = await app.request('/api/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.user).toBeTruthy();
    expect(body.user.username).toBe('meuser');
    expect(body.user.id).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await app.request('/api/me', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await app.request('/api/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid-jwt-token' },
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  let token: string;

  beforeAll(async () => {
    db.exec('DELETE FROM users');
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'refreshuser', password: 'test1234' }),
    });
    const body: any = await res.json();
    token = body.token;
  });

  it('issues a new token from a valid token', async () => {
    // Wait 1.1s to ensure a different iat (jose uses second-level precision)
    await new Promise((r) => setTimeout(r, 1100));
    const res = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.token).not.toBe(token);
  });

  it('returns 401 without token for refresh', async () => {
    const res = await app.request('/api/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 401 when user was deleted from DB', async () => {
    // Register a temporary user and get a valid token
    const regRes = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'tempuser', password: 'test1234' }),
    });
    const regBody: any = await regRes.json();
    const tempToken = regBody.token;

    // Delete the user directly from the database
    db.prepare('DELETE FROM users WHERE username = ?').run('tempuser');

    // The token was signed for the deleted user — refresh must fail
    const res = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.error).toBe('User not found');
  });
});
