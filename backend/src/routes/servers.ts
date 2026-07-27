/**
 * Servers API (T18).
 *
 * GET    /api/servers       — list current user's servers
 * POST   /api/servers       — create server (validates name, host, port)
 * PUT    /api/servers/:id   — update server (partial update)
 * DELETE /api/servers/:id   — delete server
 *
 * All per-user scoped. JWT-protected.
 * Does NOT include Native Main Server (id=0) — that's a frontend-only construct.
 *
 * Fixes: host URL/IP validation, name/host length limits, NaN guards, proper HTTP status codes.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { db } from '@/db.js';
import { authMiddleware } from '../auth.js';

const router = new Hono();

// All servers routes require auth.
router.use('*', authMiddleware);

/**
 * Helper: get user_id from JWT payload.
 */
function userId(c: Context): number {
  return Number(c.get('user').sub);
}

/**
 * Validate port number is in range 1-65535.
 */
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validate host is a valid hostname or IP address.
 * Rejects URLs with schemes, javascript:, data:, etc.
 */
function isValidHost(host: string): boolean {
  if (!host || host.trim().length === 0) return false;
  if (host.length > 255) return false;

  // Reject schemes
  if (/^[a-z][a-z0-9+.-]*:/i.test(host)) return false;

  // Allow hostnames, IPs, and optionally port-less hostnames
  // Basic validation: no spaces, no control chars
  if (/[\s\x00-\x1f\x7f]/.test(host)) return false;

  // If it contains a colon, it might be IPv6 or host:port
  // For simplicity, just allow hostnames and IPs without ports
  // (the port is a separate field)
  if (host.includes(':')) {
    // Could be IPv6 address — allow if it looks like one
    if (!/^\[?[0-9a-fA-F:]+\]?$/.test(host)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate server creation/update body fields.
 * Returns an error message string or null if valid.
 */
function validateServerInput(name: string | undefined, host: string | undefined, port: number | undefined): string | null {
  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return 'Server name is required';
    }
    if (trimmed.length > 100) {
      return 'Server name too long (max 100 characters)';
    }
  }
  if (host !== undefined) {
    const trimmed = host.trim();
    if (trimmed.length === 0) {
      return 'Host is required';
    }
    if (!isValidHost(trimmed)) {
      return 'Invalid host (must be a hostname or IP address, no scheme)';
    }
  }
  if (port !== undefined && !isValidPort(port)) {
    return 'Port must be an integer between 1 and 65535';
  }
  return null;
}

/**
 * GET /api/servers
 * List current user's servers.
 * Returns: { id, name, host, port, createdAt }[]
 */
router.get('/', (c: Context) => {
  const uid = userId(c);

  const rows = db.prepare(`
    SELECT id, name, host, port, created_at AS createdAt
    FROM servers
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(uid);

  return c.json(rows);
});

/**
 * POST /api/servers
 * Create a server for the current user.
 * Body: { name: string, host: string, port: number }
 * Returns: { id, name, host, port, createdAt } with 201
 */
router.post('/', async (c: Context) => {
  const uid = userId(c);

  let parsed: { name?: string; host?: string; port?: number };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const name = parsed.name?.trim();
  const host = parsed.host?.trim();
  const port = parsed.port;

  const validationError = validateServerInput(name, host, port);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const info = db.prepare(
    'INSERT INTO servers (user_id, name, host, port) VALUES (?, ?, ?, ?)'
  ).run(uid, name, host, port);

  const server = db.prepare(`
    SELECT id, name, host, port, created_at AS createdAt
    FROM servers WHERE id = ?
  `).get(info.lastInsertRowid);

  return c.json(server, 201);
});

/**
 * PUT /api/servers/:id
 * Update a server. All fields are optional — only provided fields are updated.
 * Body: { name?, host?, port? }
 * Returns: the updated server object.
 * 404 if not found or not owned.
 */
router.put('/:id', async (c: Context) => {
  const uid = userId(c);
  const serverId = Number(c.req.param('id'));
  if (isNaN(serverId)) {
    return c.json({ error: 'Invalid server ID' }, 400);
  }

  // Check ownership
  const existing = db.prepare(
    'SELECT id, name, host, port FROM servers WHERE id = ? AND user_id = ?'
  ).get(serverId, uid) as { id: number; name: string; host: string; port: number } | undefined;

  if (!existing) {
    return c.json({ error: 'Server not found' }, 404);
  }

  let parsed: { name?: string; host?: string; port?: number };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const name = parsed.name?.trim() ?? existing.name;
  const host = parsed.host?.trim() ?? existing.host;
  const port = parsed.port ?? existing.port;

  // Validate only the fields that changed
  const fieldsToValidate: { name?: string; host?: string; port?: number } = {};
  if (parsed.name !== undefined) fieldsToValidate.name = name;
  if (parsed.host !== undefined) fieldsToValidate.host = host;
  if (parsed.port !== undefined) fieldsToValidate.port = port;

  const validationError = validateServerInput(
    fieldsToValidate.name,
    fieldsToValidate.host,
    fieldsToValidate.port
  );

  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  db.prepare(
    'UPDATE servers SET name = ?, host = ?, port = ? WHERE id = ?'
  ).run(name, host, port, serverId);

  const updated = db.prepare(`
    SELECT id, name, host, port, created_at AS createdAt
    FROM servers WHERE id = ?
  `).get(serverId);

  return c.json(updated);
});

/**
 * DELETE /api/servers/:id
 * Delete a server. 404 if not found or not owned.
 */
router.delete('/:id', (c: Context) => {
  const uid = userId(c);
  const serverId = Number(c.req.param('id'));
  if (isNaN(serverId)) {
    return c.json({ error: 'Invalid server ID' }, 400);
  }

  const existing = db.prepare(
    'SELECT id FROM servers WHERE id = ? AND user_id = ?'
  ).get(serverId, uid);

  if (!existing) {
    return c.json({ error: 'Server not found' }, 404);
  }

  db.prepare('DELETE FROM servers WHERE id = ?').run(serverId);

  return c.json({ message: 'Server deleted' });
});

export default router;