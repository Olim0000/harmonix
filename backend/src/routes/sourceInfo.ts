/**
 * Source info route (T12).
 *
 * GET /api/source/info
 * Returns role-specific information about this server.
 *
 * source role: { isSource: true, hasMusicDir: bool, musicDir: string? }
 * player role: { isSource: false }
 *
 * On a player-only server, source routes should return 404 (mounted in index.ts).
 */
import { Hono } from 'hono';
import { env } from '../env.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

const router = new Hono();

/**
 * GET /api/source/info
 * No auth required — frontend needs this before login for server discovery.
 */
router.get('/info', (c) => {
  if (env.role !== 'source') {
    return c.json({ isSource: false });
  }

  // Fix M3: resolve relative path before checking existence
  const musicDirRaw = env.musicDir || null;
  const musicDirAbs = musicDirRaw ? resolve(musicDirRaw) : null;
  const hasMusicDir = musicDirAbs !== null && existsSync(musicDirAbs);

  return c.json({
    isSource: true,
    hasMusicDir,
    musicDir: hasMusicDir ? musicDirAbs : null,
  });
});

export default router;
