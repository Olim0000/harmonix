import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '@/db.js';
import { signToken } from '@/jwt.js';
import { authMiddleware } from '@/auth.js';
import type { User } from '@/types.js';

/**
 * Auth-related routes.
 *
 * Mounting plan (in index.ts):
 *   app.route('/api/auth', authRoutes);    // POST /api/auth/register, /login, /refresh
 *   app.get('/api/me', ...meHandler);       // GET /api/me
 */

export const authRoutes = new Hono();

/**
 * POST /register → /api/auth/register
 * Body: { username, password }
 * Returns: { token, user }
 */
authRoutes.post('/register', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return c.json({ error: 'Username taken' }, 409);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, passwordHash, 'user');

  const user: User = {
    id: result.lastInsertRowid as number,
    username,
    role: 'user',
    created_at: new Date().toISOString(),
  };

  const token = await signToken({ sub: String(user.id), role: user.role });

  return c.json({ token, user });
});

/**
 * POST /login → /api/auth/login
 * Body: { username, password }
 * Returns: { token, user }
 */
authRoutes.post('/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const row = db.prepare(
    'SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?'
  ).get(username) as UserRow | undefined;

  if (!row) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = bcrypt.compareSync(password, row.password_hash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const user: User = {
    id: row.id,
    username: row.username,
    role: row.role,
    created_at: row.created_at,
  };

  const token = await signToken({ sub: String(user.id), role: user.role });

  return c.json({ token, user });
});

/**
 * POST /refresh → /api/auth/refresh
 * Requires auth middleware.
 * Returns: { token }
 */
authRoutes.post('/refresh', authMiddleware, async (c) => {
  const tokenPayload = c.get('user');

  // Verify user still exists in DB — deleted users should not get new tokens
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(tokenPayload.sub)) as { id: number } | undefined;
  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  const token = await signToken({ sub: tokenPayload.sub, role: tokenPayload.role });
  return c.json({ token });
});

/**
 * GET /api/me handler — requires auth middleware wired in index.ts.
 */
export async function meHandler(c: any): Promise<Response> {
  const tokenPayload = c.get('user');
  const row = db.prepare(
    'SELECT id, username, role, created_at FROM users WHERE id = ?'
  ).get(Number(tokenPayload.sub)) as UserRow | undefined;

  if (!row) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    user: {
      id: row.id,
      username: row.username,
      role: row.role,
      created_at: row.created_at,
    },
  });
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: string;
}

export default authRoutes;
