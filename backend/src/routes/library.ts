import { Hono } from 'hono';
import { db } from '@/db.js';
import type { Artist, Album, Track } from '@/types.js';

/**
 * Library routes for browsing artists, albums, and tracks.
 *
 * Auth: All read endpoints require authentication.
 * Reason: In a multi-user media server, unauthenticated access to library metadata
 * could leak information about the collection. The player-server also uses tokens,
 * so requiring auth uniformly simplifies the auth model.
 */
const router = new Hono();

/**
 * GET /api/artists — list all artists with album_count
 */
router.get('/artists', (c) => {
  const rows = db.prepare(`
    SELECT a.*, COUNT(al.id) AS album_count
    FROM artists a
    LEFT JOIN albums al ON al.artist_id = a.id
    GROUP BY a.id
    ORDER BY a.sort_name COLLATE NOCASE, a.name COLLATE NOCASE
  `).all() as (Artist & { album_count: number })[];

  return c.json(rows);
});

/**
 * GET /api/artists/:id — single artist with albums array
 */
router.get('/artists/:id', (c) => {
  const id = Number(c.req.param('id'));
  const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(id) as Artist | undefined;

  if (!artist) {
    return c.json({ error: 'Artist not found' }, 404);
  }

  const albums = db.prepare(`
    SELECT al.*, COUNT(t.id) AS track_count
    FROM albums al
    LEFT JOIN tracks t ON t.album_id = al.id
    WHERE al.artist_id = ?
    GROUP BY al.id
    ORDER BY al.year, al.title
  `).all(id) as (Album & { track_count: number })[];

  return c.json({ artist, albums });
});

/**
 * GET /api/albums — list all albums with artist_name and track_count
 */
router.get('/albums', (c) => {
  const rows = db.prepare(`
    SELECT al.*, ar.name AS artist_name, COUNT(t.id) AS track_count
    FROM albums al
    JOIN artists ar ON ar.id = al.artist_id
    LEFT JOIN tracks t ON t.album_id = al.id
    GROUP BY al.id
    ORDER BY al.year DESC, al.title COLLATE NOCASE
  `).all() as (Album & { artist_name: string; track_count: number })[];

  return c.json(rows);
});

/**
 * GET /api/albums/:id — single album with tracks array
 */
router.get('/albums/:id', (c) => {
  const id = Number(c.req.param('id'));
  const album = db.prepare(`
    SELECT al.*, ar.name AS artist_name
    FROM albums al
    JOIN artists ar ON ar.id = al.artist_id
    WHERE al.id = ?
  `).get(id) as (Album & { artist_name: string }) | undefined;

  if (!album) {
    return c.json({ error: 'Album not found' }, 404);
  }

  const tracks = db.prepare(`
    SELECT t.*, ar.name AS artist_name, al.title AS album_title
    FROM tracks t
    JOIN artists ar ON ar.id = t.artist_id
    JOIN albums al ON al.id = t.album_id
    WHERE t.album_id = ?
    ORDER BY t.track_number
  `).all(id) as (Track & { artist_name: string; album_title: string })[];

  return c.json({ album, tracks });
});

/**
 * GET /api/tracks/:id — single track with artist_name and album_title
 */
router.get('/tracks/:id', (c) => {
  const id = Number(c.req.param('id'));
  const track = db.prepare(`
    SELECT t.*, ar.name AS artist_name, al.title AS album_title
    FROM tracks t
    JOIN artists ar ON ar.id = t.artist_id
    JOIN albums al ON al.id = t.album_id
    WHERE t.id = ?
  `).get(id) as (Track & { artist_name: string; album_title: string }) | undefined;

  if (!track) {
    return c.json({ error: 'Track not found' }, 404);
  }

  return c.json({ track });
});

export default router;
