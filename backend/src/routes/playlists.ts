/**
 * Playlists API (T17).
 *
 * POST   /api/playlists              — create playlist (201)
 * GET    /api/playlists              — list user's playlists with trackCount
 * GET    /api/playlists/:id          — get playlist with tracks (resolved)
 * POST   /api/playlists/:id/tracks   — add track (duplicate → 409, with INSERT OR IGNORE)
 * DELETE /api/playlists/:id/tracks/:trackId — remove track + compact positions
 * PUT    /api/playlists/:id/reorder  — full reorder (validates permutation, uses transaction)
 * DELETE /api/playlists/:id          — delete playlist (cascade via FK)
 *
 * Positions are 0-based (first track = position 0).
 * Fixes: TOCTOU races using transactions, 201 for create, proper validation.
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { db } from '@/db.js';
import { authMiddleware } from '../auth.js';

const router = new Hono();

// All playlists routes require auth.
router.use('*', authMiddleware);

/**
 * Helper: get user_id from JWT payload.
 */
function userId(c: Context): number {
  return Number(c.get('user').sub);
}

/**
 * POST /api/playlists
 * Create a playlist for the current user.
 * Body: { name: string }
 * Returns: { id, name, createdAt } with 201
 * Rejects empty name → 400. Name max 200 chars.
 */
router.post('/', async (c: Context) => {
  const uid = userId(c);

  let parsed: { name?: string };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const name = parsed.name?.trim();
  if (!name || name.length === 0) {
    return c.json({ error: 'Playlist name is required' }, 400);
  }
  if (name.length > 200) {
    return c.json({ error: 'Playlist name too long (max 200 characters)' }, 400);
  }

  const info = db.prepare(
    'INSERT INTO playlists (user_id, name) VALUES (?, ?)'
  ).run(uid, name);

  const playlist = db.prepare(
    'SELECT id, name, created_at AS createdAt FROM playlists WHERE id = ?'
  ).get(info.lastInsertRowid) as { id: number; name: string; createdAt: string };

  return c.json(playlist, 201);
});

/**
 * GET /api/playlists
 * List current user's playlists with trackCount.
 * Returns: { id, name, trackCount, createdAt }[]
 */
router.get('/', (c: Context) => {
  const uid = userId(c);

  const rows = db.prepare(`
    SELECT p.id, p.name, COUNT(pi.track_id) AS trackCount, p.created_at AS createdAt
    FROM playlists p
    LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all(uid) as { id: number; name: string; trackCount: number; createdAt: string }[];

  return c.json(rows);
});

/**
 * GET /api/playlists/:id
 * Get a single playlist with its tracks (resolved with title, artist, album, duration).
 * Returns: { id, name, tracks: Track[] }
 * Track shape: { id, title, artist, album, duration, position }
 * 404 if not found or not owned by current user.
 */
router.get('/:id', (c: Context) => {
  const uid = userId(c);
  const playlistId = Number(c.req.param('id'));
  if (isNaN(playlistId)) {
    return c.json({ error: 'Invalid playlist ID' }, 400);
  }

  const playlist = db.prepare(
    'SELECT id, name, created_at AS createdAt FROM playlists WHERE id = ? AND user_id = ?'
  ).get(playlistId, uid) as { id: number; name: string; createdAt: string } | undefined;

  if (!playlist) {
    return c.json({ error: 'Playlist not found' }, 404);
  }

  const tracks = db.prepare(`
    SELECT t.id, t.title, ar.name AS artist, al.title AS album, t.duration_seconds AS duration,
           pi.position
    FROM playlist_items pi
    JOIN tracks t ON t.id = pi.track_id
    JOIN artists ar ON ar.id = t.artist_id
    JOIN albums al ON al.id = t.album_id
    WHERE pi.playlist_id = ?
    ORDER BY pi.position
  `).all(playlistId) as { id: number; title: string; artist: string; album: string; duration: number | null; position: number }[];

  return c.json({ ...playlist, tracks });
});

/**
 * POST /api/playlists/:id/tracks
 * Add a track to the playlist.
 * Body: { trackId: number }
 * Duplicate detection: INSERT OR IGNORE + check changes → 409 if duplicate.
 * Inserts at end (position = max+1).
 * Returns: { position }
 * 404 if playlist not found or not owned.
 */
router.post('/:id/tracks', async (c: Context) => {
  const uid = userId(c);
  const playlistId = Number(c.req.param('id'));
  if (isNaN(playlistId)) {
    return c.json({ error: 'Invalid playlist ID' }, 400);
  }

  // Verify ownership
  const playlist = db.prepare(
    'SELECT id FROM playlists WHERE id = ? AND user_id = ?'
  ).get(playlistId, uid);

  if (!playlist) {
    return c.json({ error: 'Playlist not found' }, 404);
  }

  let parsed: { trackId?: number };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { trackId } = parsed;
  if (trackId === undefined || trackId === null || typeof trackId !== 'number' || isNaN(trackId)) {
    return c.json({ error: 'trackId is required and must be a number' }, 400);
  }

  // Use INSERT OR IGNORE to avoid TOCTOU race on duplicate check
  // Get max position in same transaction
  const addTrackTransaction = db.transaction(() => {
    // Get max position
    const maxPos = db.prepare(
      'SELECT MAX(position) AS m FROM playlist_items WHERE playlist_id = ?'
    ).get(playlistId) as { m: number | null };

    const position = (maxPos.m !== null ? maxPos.m : -1) + 1;

    const result = db.prepare(
      'INSERT OR IGNORE INTO playlist_items (playlist_id, track_id, position) VALUES (?, ?, ?)'
    ).run(playlistId, trackId, position);

    if (result.changes === 0) {
      // Duplicate - check if it already exists
      const existing = db.prepare(
        'SELECT position FROM playlist_items WHERE playlist_id = ? AND track_id = ?'
      ).get(playlistId, trackId) as { position: number } | undefined;

      if (existing) {
        throw { code: 'DUPLICATE', position: existing.position };
      }
      // Race condition where track was deleted between check and insert - shouldn't happen
      throw { code: 'UNKNOWN' };
    }

    return { position };
  });

  try {
    const result = addTrackTransaction();
    return c.json({ position: result.position });
  } catch (err: any) {
    if (err.code === 'DUPLICATE') {
      return c.json({ error: 'Already in playlist' }, 409);
    }
    return c.json({ error: 'Failed to add track' }, 500);
  }
});

/**
 * DELETE /api/playlists/:id/tracks/:trackId
 * Remove a track from the playlist. Compacts positions (no gaps).
 * 404 if playlist not found/owned or track not in playlist.
 * Uses transaction to avoid race with concurrent reorder.
 */
router.delete('/:id/tracks/:trackId', (c: Context) => {
  const uid = userId(c);
  const playlistId = Number(c.req.param('id'));
  const trackId = Number(c.req.param('trackId'));

  if (isNaN(playlistId) || isNaN(trackId)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }

  // Verify ownership
  const playlist = db.prepare(
    'SELECT id FROM playlists WHERE id = ? AND user_id = ?'
  ).get(playlistId, uid);

  if (!playlist) {
    return c.json({ error: 'Playlist not found' }, 404);
  }

  // Transaction: delete + compact
  const removeTransaction = db.transaction(() => {
    // Get position of item to delete
    const item = db.prepare(
      'SELECT position FROM playlist_items WHERE playlist_id = ? AND track_id = ?'
    ).get(playlistId, trackId) as { position: number } | undefined;

    if (!item) {
      throw { code: 'NOT_FOUND' };
    }

    const deletedPosition = item.position;

    db.prepare(
      'DELETE FROM playlist_items WHERE playlist_id = ? AND track_id = ?'
    ).run(playlistId, trackId);

    // Compact: decrement positions of all tracks after the deleted one
    db.prepare(
      'UPDATE playlist_items SET position = position - 1 WHERE playlist_id = ? AND position > ?'
    ).run(playlistId, deletedPosition);
  });

  try {
    removeTransaction();
  } catch (err: any) {
    if (err.code === 'NOT_FOUND') {
      return c.json({ error: 'Track not in playlist' }, 404);
    }
    return c.json({ error: 'Failed to remove track' }, 500);
  }

  return c.json({ message: 'Track removed' });
});

/**
 * PUT /api/playlists/:id/reorder
 * Full reorder of tracks in the playlist.
 * Body: { trackIds: number[] }
 * Validates that trackIds is a permutation of current tracks in the playlist.
 * Updates positions atomically in a transaction.
 * Returns: { message: 'Reordered' }
 * 404 if playlist not found/owned. 400 if invalid permutation.
 */
router.put('/:id/reorder', async (c: Context) => {
  const uid = userId(c);
  const playlistId = Number(c.req.param('id'));

  if (isNaN(playlistId)) {
    return c.json({ error: 'Invalid playlist ID' }, 400);
  }

  // Verify ownership
  const playlist = db.prepare(
    'SELECT id FROM playlists WHERE id = ? AND user_id = ?'
  ).get(playlistId, uid);

  if (!playlist) {
    return c.json({ error: 'Playlist not found' }, 404);
  }

  let parsed: { trackIds?: number[] };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { trackIds } = parsed;
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    return c.json({ error: 'trackIds must be a non-empty array' }, 400);
  }

  // Get current track ids in order (for validation)
  const currentRows = db.prepare(
    'SELECT track_id FROM playlist_items WHERE playlist_id = ? ORDER BY position'
  ).all(playlistId) as { track_id: number }[];

  const currentIds = currentRows.map(r => r.track_id);

  if (currentIds.length !== trackIds.length) {
    return c.json({ error: 'Invalid permutation: length mismatch' }, 400);
  }

  // Check for duplicates in request
  const uniqueRequested = new Set(trackIds);
  if (uniqueRequested.size !== trackIds.length) {
    return c.json({ error: 'Invalid permutation: duplicates in request' }, 400);
  }

  // Validate permutation (sets equal)
  const currentSet = new Set(currentIds);
  for (const id of trackIds) {
    if (!currentSet.has(id)) {
      return c.json({ error: 'Invalid permutation: track id not in playlist' }, 400);
    }
  }

  // Update positions in a transaction
  const reorderTransaction = db.transaction(() => {
    const updateStmt = db.prepare(
      'UPDATE playlist_items SET position = ? WHERE playlist_id = ? AND track_id = ?'
    );

    for (let i = 0; i < trackIds.length; i++) {
      updateStmt.run(i, playlistId, trackIds[i]);
    }
  });

  reorderTransaction();

  return c.json({ message: 'Reordered' });
});

/**
 * DELETE /api/playlists/:id
 * Delete a playlist. Cascade deletes playlist_items via FK.
 * 404 if not found or not owned.
 */
router.delete('/:id', (c: Context) => {
  const uid = userId(c);
  const playlistId = Number(c.req.param('id'));

  if (isNaN(playlistId)) {
    return c.json({ error: 'Invalid playlist ID' }, 400);
  }

  const playlist = db.prepare(
    'SELECT id FROM playlists WHERE id = ? AND user_id = ?'
  ).get(playlistId, uid);

  if (!playlist) {
    return c.json({ error: 'Playlist not found' }, 404);
  }

  db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);

  return c.json({ message: 'Playlist deleted' });
});

export default router;