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
 */
router.get('/search', (c) => {
  const q = c.req.query('q') || '';

  if (!q.trim()) {
    return c.json([]);
  }

  // FTS5 query format: prefix matching for partial queries, escape special chars
  // Wrap each word with * for prefix matching
  const sanitized = q.replace(/[^\w\s-]/g, '').trim();
  if (!sanitized) {
    return c.json([]);
  }

  // FTS5 prefix query: each word becomes a prefix match (word*)
  // Prefix operator * must be attached to a bare token, not a quoted phrase
  const ftsQuery = sanitized.split(/\s+/).map(w => `${w}*`).join(' ');

  let results: { rowid: number; title: string; artist_name: string; album_title: string }[];
  try {
    results = db.prepare(`
      SELECT rowid, title, artist_name, album_title
      FROM search_fts
      WHERE search_fts MATCH ?
      LIMIT 30
    `).all(ftsQuery) as any[];
  } catch {
    // If FTS5 query fails (e.g., syntax error in query), return empty
    return c.json([]);
  }

  // Map FTS results back to full data using the type-tagged rowid scheme
  const output: SearchResult[] = [];

  for (const row of results) {
    const { type, id } = ftsTypeAndId(row.rowid);

    if (type === 'artist') {
      const artist = db.prepare('SELECT id, name AS title, image_path AS cover_path FROM artists WHERE id = ?').get(id) as any;
      if (artist) {
        output.push({
          type: 'artist',
          id: artist.id,
          title: artist.title,
          cover_path: artist.cover_path ?? undefined,
        });
      }
    } else if (type === 'album') {
      const album = db.prepare(`
        SELECT al.id, al.title, al.year, al.cover_path, ar.name AS artist_name
        FROM albums al
        JOIN artists ar ON ar.id = al.artist_id
        WHERE al.id = ?
      `).get(id) as any;
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
      const track = db.prepare(`
        SELECT t.id, t.title, t.track_number, t.duration_seconds,
               ar.name AS artist_name, al.title AS album_title, al.cover_path
        FROM tracks t
        JOIN artists ar ON ar.id = t.artist_id
        JOIN albums al ON al.id = t.album_id
        WHERE t.id = ?
      `).get(id) as any;
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

    // Hard limit at 30
    if (output.length >= 30) break;
  }

  return c.json(output);
});

export default router;
