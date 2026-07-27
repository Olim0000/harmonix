import { Hono } from 'hono';
import { db, ftsTypeAndId } from '@/db.js';
import type { SearchResult } from '@/types.js';

const router = new Hono();

/**
 * GET /api/search?q=...
 *
 * Query the FTS5 search_fts table and return ≤30 combined results type-tagged
 * (track/artist/album) with metadata (artist_name, album_title, cover_path, duration_seconds).
 *
 * Empty q returns [] with 200.
 * Fixes: Unicode-aware sanitization, proper ORDER BY relevance, batch queries to avoid N+1.
 */
router.get('/search', (c) => {
  const q = c.req.query('q') || '';

  if (!q.trim()) {
    return c.json([]);
  }

  // FTS5 query format: prefix matching for partial queries, escape special chars
  // Wrap each word with * for prefix matching
  // Use Unicode-aware regex (u flag) to preserve diacritics
  const sanitized = q.replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
  if (!sanitized) {
    return c.json([]);
  }

  // FTS5 prefix query: each word becomes a prefix match (word*)
  // Prefix operator * must be attached to a bare token, not a quoted phrase
  const ftsQuery = sanitized.split(/\s+/).map(w => `${w}*`).join(' ');

  let results: { rowid: number; title: string; artist_name: string; album_title: string; rank: number }[];
  try {
    results = db.prepare(`
      SELECT rowid, title, artist_name, album_title, rank
      FROM search_fts
      WHERE search_fts MATCH ?
      ORDER BY rank
      LIMIT 30
    `).all(ftsQuery) as any[];
  } catch {
    // If FTS5 query fails (e.g., syntax error in query), return empty
    return c.json([]);
  }

  // Map FTS results back to full data using the type-tagged rowid scheme
  // Batch the lookups to avoid N+1 queries
  const artistIds: number[] = [];
  const albumIds: number[] = [];
  const trackIds: number[] = [];

  for (const row of results) {
    const { type, id } = ftsTypeAndId(row.rowid);
    if (type === 'artist') artistIds.push(id);
    else if (type === 'album') albumIds.push(id);
    else if (type === 'track') trackIds.push(id);
  }

  const artistMap = new Map<number, any>();
  const albumMap = new Map<number, any>();
  const trackMap = new Map<number, any>();

  if (artistIds.length > 0) {
    const placeholders = artistIds.map(() => '?').join(',');
    const artists = db.prepare(`
      SELECT id, name AS title, image_path AS cover_path
      FROM artists WHERE id IN (${placeholders})
    `).all(...artistIds) as any[];
    for (const a of artists) artistMap.set(a.id, a);
  }

  if (albumIds.length > 0) {
    const placeholders = albumIds.map(() => '?').join(',');
    const albums = db.prepare(`
      SELECT al.id, al.title, al.year, al.cover_path, ar.name AS artist_name
      FROM albums al
      JOIN artists ar ON ar.id = al.artist_id
      WHERE al.id IN (${placeholders})
    `).all(...albumIds) as any[];
    for (const a of albums) albumMap.set(a.id, a);
  }

  if (trackIds.length > 0) {
    const placeholders = trackIds.map(() => '?').join(',');
    const tracks = db.prepare(`
      SELECT t.id, t.title, t.track_number, t.duration_seconds,
             ar.name AS artist_name, al.title AS album_title, al.cover_path
      FROM tracks t
      JOIN artists ar ON ar.id = t.artist_id
      JOIN albums al ON al.id = t.album_id
      WHERE t.id IN (${placeholders})
    `).all(...trackIds) as any[];
    for (const t of tracks) trackMap.set(t.id, t);
  }

  const output: SearchResult[] = [];

  for (const row of results) {
    const { type, id } = ftsTypeAndId(row.rowid);

    if (type === 'artist') {
      const artist = artistMap.get(id);
      if (artist) {
        output.push({
          type: 'artist',
          id: artist.id,
          title: artist.title,
          cover_path: artist.cover_path ?? undefined,
        });
      }
    } else if (type === 'album') {
      const album = albumMap.get(id);
      if (album) {
        output.push({
          type: 'album',
          id: album.id,
          title: album.title,
          artist_name: album.artist_name,
          year: album.year ?? undefined,
          cover_path: album.cover_path ?? undefined,
        });
      }
    } else if (type === 'track') {
      const track = trackMap.get(id);
      if (track) {
        output.push({
          type: 'track',
          id: track.id,
          title: track.title,
          artist_name: track.artist_name,
          album_title: track.album_title,
          track_number: track.track_number ?? undefined,
          duration_seconds: track.duration_seconds ?? undefined,
          cover_path: track.cover_path ?? undefined,
        });
      }
    }

    if (output.length >= 30) break;
  }

  return c.json(output);
});

export default router;