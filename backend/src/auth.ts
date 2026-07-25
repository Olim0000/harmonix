import { Context, Next } from 'hono';
import { verifyToken, extractToken, type TokenPayload } from './jwt.js';
import { logger } from './logger.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const token = extractToken(c.req.header('Authorization'));
  if (!token) {
    logger.debug('Auth failed: no token provided');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = await verifyToken(token);
    c.set('user', payload);
    await next();
  } catch (err) {
    logger.debug({ err }, 'Auth failed: invalid token');
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

export async function requireAdmin(c: Context, next: Next): Promise<Response | void> {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden: admin required' }, 403);
  }
  return next();
}