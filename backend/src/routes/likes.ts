/**
 * Likes API (T16).
 *
 * POST /api/likes — toggle like state (insert or delete)
 * GET  /api/likes — list current user's liked items, optionally filtered by ?itemType=
 *
 * Notes:
 * - item_id in the DB is INTEGER. The route accepts string itemId and converts to number.
 * - Resolved details are included via LEFT JOINs for frontend ergonomics:
 *   tracks → title, artist, album
 *   artists → name
 *   albums → title, artist
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { db } from '@/db.js';
import { authMiddleware } from '../auth.js';

const router = new Hono();

// All likes routes require auth.
// Mounted at /api/likes via app.route('/api/likes', ...) — the wildcard auth
// is scoped to this router's path and won't leak to sibling routes.
router.use('*', authMiddleware);

interface LikeRow {
  itemType: string;
  itemId: number;
  createdAt: string;
  title?: string;
  name?: string;
  artist?: string;
  album?: string;
}

/**
 * POST /api/likes
 * Toggle like: insert if not present, delete if present.
 * Body: { itemType: 'track' | 'artist' | 'album', itemId: string }
 * Returns: { liked: boolean }
 */
router.post('/', async (c: Context) => {
  const userId = Number(c.get('user').sub);

  let parsed: { itemType?: string; itemId?: string };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { itemType, itemId: rawItemId } = parsed;

  if (!itemType || !['track', 'artist', 'album'].includes(itemType)) {
    return c.json({ error: 'itemType must be track, artist, or album' }, 400);
  }
  if (rawItemId === undefined || rawItemId === null) {
    return c.json({ error: 'itemId is required' }, 400);
  }

  const itemIdNum = Number(rawItemId);
  if (isNaN(itemIdNum)) {
    return c.json({ error: 'itemId must be a valid number' }, 400);
  }

  // Check if already liked
  const existing = db.prepare(
    'SELECT 1 FROM likes WHERE user_id = ? AND item_type = ? AND item_id = ?'
  ).get(userId, itemType, itemIdNum);

  if (existing) {
    // Unlike
    db.prepare(
      'DELETE FROM likes WHERE user_id = ? AND item_type = ? AND item_id = ?'
    ).run(userId, itemType, itemIdNum);
    return c.json({ liked: false });
  }

  // Like
  db.prepare(
    'INSERT INTO likes (user_id, item_type, item_id) VALUES (?, ?, ?)'
  ).run(userId, itemType, itemIdNum);
  return c.json({ liked: true });
});

/**
 * GET /api/likes
 * Query: ?itemType=track|artist|album (optional, returns all types if omitted)
 * Returns: { itemType, itemId, createdAt, ...resolved }[]
 */
router.get('/', (c: Context) => {
  const userId = Number(c.get('user').sub);
  const itemType = c.req.query('itemType');

  if (itemType && !['track', 'artist', 'album'].includes(itemType)) {
    return c.json({ error: 'itemType must be track, artist, or album' }, 400);
  }

  let rows: LikeRow[] = [];

  if (itemType === 'track') {
    rows = db.prepare(`
      SELECT l.item_type AS itemType, l.item_id AS itemId, l.created_at AS createdAt,
             t.title, ar.name AS artist, al.title AS album
      FROM likes l
      LEFT JOIN tracks t ON t.id = l.item_id
      LEFT JOIN artists ar ON ar.id = t.artist_id
      LEFT JOIN albums al ON al.id = t.album_id
      WHERE l.user_id = ? AND l.item_type = 'track'
      ORDER BY l.created_at DESC
    `).all(userId) as LikeRow[];
  } else if (itemType === 'artist') {
    rows = db.prepare(`
      SELECT l.item_type AS itemType, l.item_id AS itemId, l.created_at AS createdAt,
             a.name
      FROM likes l
      LEFT JOIN artists a ON a.id = l.item_id
      WHERE l.user_id = ? AND l.item_type = 'artist'
      ORDER BY l.created_at DESC
    `).all(userId) as LikeRow[];
  } else if (itemType === 'album') {
    rows = db.prepare(`
      SELECT l.item_type AS itemType, l.item_id AS itemId, l.created_at AS createdAt,
             al.title, ar.name AS artist
      FROM likes l
      LEFT JOIN albums al ON al.id = l.item_id
      LEFT JOIN artists ar ON ar.id = al.artist_id
      WHERE l.user_id = ? AND l.item_type = 'album'
      ORDER BY l.created_at DESC
    `).all(userId) as LikeRow[];
  } else {
    // All types — fetch each type separately for correct joins
    const tracks = db.prepare(`
      SELECT l.item_type AS itemType, l.item_id AS itemId, l.created_at AS createdAt,
             t.title, ar.name AS artist, al.title AS album
      FROM likes l
      LEFT JOIN tracks t ON t.id = l.item_id
      LEFT JOIN artists ar ON ar.id = t.artist_id
      LEFT JOIN albums al ON al.id = t.album_id
      WHERE l.user_id = ? AND l.item_type = 'track'
      ORDER BY l.created_at DESC
    `).all(userId) as LikeRow[];

    const artists = db.prepare(`
      SELECT l.item_type AS itemType, l.item_id AS itemId, l.created_at AS createdAt,
             a.name
      FROM likes l
      LEFT JOIN artists a ON a.id = l.item_id
      WHERE l.user_id = ? AND l.item_type = 'artist'
      ORDER BY l.created_at DESC
    `).all(userId) as LikeRow[];

    const albums = db.prepare(`
      SELECT l.item_type AS itemType, l.item_id AS itemId, l.created_at AS createdAt,
             al.title, ar.name AS artist
      FROM likes l
      LEFT JOIN albums al ON al.id = l.item_id
      LEFT JOIN artists ar ON ar.id = al.artist_id
      WHERE l.user_id = ? AND l.item_type = 'album'
      ORDER BY l.created_at DESC
    `).all(userId) as LikeRow[];

    rows = [...tracks, ...artists, ...albums];
    // Sort by createdAt descending across types
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return c.json(rows);
});

export default router;
