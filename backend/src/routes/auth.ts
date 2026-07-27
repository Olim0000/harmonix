import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '@/db.js';
import { signToken } from '@/jwt.js';
import { authMiddleware } from '@/auth.js';
import type { User } from '@/types.js';
import { logger } from '@/logger.js';

/**
 * Simple in-memory rate limiter for auth endpoints.
 * In production, use Redis or a distributed store.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const authRateLimits = new Map<string, RateLimitEntry>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = authRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    authRateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count++;
  return true;
}

/**
 * Validate password strength.
 */
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

export const authRoutes = new Hono();

/**
 * POST /register → /api/auth/register
 * Body: { username, password }
 * Returns: { token, user }
 */
authRoutes.post('/register', async (c) => {
  // Rate limit: 5 requests per minute per IP
  const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  if (!checkRateLimit(`register:${clientIp}`, 5, 60_000)) {
    return c.json({ error: 'Too many registration attempts. Try again later.' }, 429);
  }

  let parsed: { username?: string; password?: string };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { username, password } = parsed;

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return c.json({ error: passwordError }, 400);
  }

  // Case-insensitive username check
  const existing = db.prepare(
    'SELECT id FROM users WHERE lower(username) = lower(?)'
  ).get(username);
  if (existing) {
    return c.json({ error: 'Username taken' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
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

  return c.json({ token, user }, 201);
});

/**
 * POST /login → /api/auth/login
 * Body: { username, password }
 * Returns: { token, user }
 */
authRoutes.post('/login', async (c) => {
  const clientIp = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  if (!checkRateLimit(`login:${clientIp}`, 10, 60_000)) {
    return c.json({ error: 'Too many login attempts. Try again later.' }, 429);
  }

  let parsed: { username?: string; password?: string };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { username, password } = parsed;

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const row = db.prepare(
    'SELECT id, username, password_hash, role, created_at FROM users WHERE lower(username) = lower(?)'
  ).get(username) as { id: number; username: string; password_hash: string; role: 'admin' | 'user'; created_at: string } | undefined;

  // Timing-safe: always run bcrypt compare even if user not found
  const hashToCompare = row?.password_hash || '$2a$12$dummyhashfordummyuserdummyh';
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!row || !valid) {
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
 * POST /logout → /api/auth/logout
 * Requires auth middleware. Adds the current token's jti to denylist.
 * Returns: { message: 'Logged out' }
 */
authRoutes.post('/logout', authMiddleware, async (c) => {
  const tokenPayload = c.get('user');
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'No token provided' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  
  // Add token to denylist (simple in-memory; use Redis in production)
  // We use a hash of the token to avoid storing the full token
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  tokenDenylist.add(tokenHash);
  
  // Also store with expiry for cleanup
  tokenExpiry.set(tokenHash, Date.now() + 15 * 60 * 1000); // 15 min TTL
  
  logger.info({ userId: tokenPayload.sub }, 'User logged out');
  return c.json({ message: 'Logged out' });
});

/**
 * POST /refresh → /api/auth/refresh
 * Requires auth middleware.
 * Returns: { token }
 */
authRoutes.post('/refresh', authMiddleware, async (c) => {
  const tokenPayload = c.get('user');

  // Verify user still exists in DB and get current role — deleted users should not get new tokens
  const user = db.prepare(
    'SELECT id, role FROM users WHERE id = ?'
  ).get(Number(tokenPayload.sub)) as { id: number; role: 'admin' | 'user' } | undefined;
  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  const token = await signToken({ sub: tokenPayload.sub, role: user.role });
  return c.json({ token });
});

/**
 * Simple in-memory token denylist for logout/revocation.
 * In production, use Redis with TTL.
 */
const tokenDenylist = new Set<string>();
const tokenExpiry = new Map<string, number>();

/**
 * Check if a token is revoked.
 */
export function isTokenRevoked(token: string): boolean {
  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  // Clean up expired entries
  const now = Date.now();
  for (const [hash, expiry] of tokenExpiry.entries()) {
    if (now > expiry) {
      tokenDenylist.delete(hash);
      tokenExpiry.delete(hash);
    }
  }
  
  return tokenDenylist.has(tokenHash);
}

/**
 * GET /api/me handler — requires auth middleware wired in index.ts.
 */
export async function meHandler(c: any): Promise<Response> {
  const tokenPayload = c.get('user');
  const row = db.prepare(
    'SELECT id, username, role, created_at FROM users WHERE id = ?'
  ).get(Number(tokenPayload.sub)) as { id: number; username: string; role: 'admin' | 'user'; created_at: string } | undefined;

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
