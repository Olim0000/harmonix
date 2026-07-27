import { Hono } from 'hono';
import { statSync, existsSync, createReadStream } from 'fs';
import { extname, resolve as pathResolve, sep } from 'path';
import { db } from '@/db.js';
import { env } from '@/env.js';
import { parseRangeHeader, formatContentRange } from '@/lib/range.js';
import type { Track } from '@/types.js';
import { logger } from '@/logger.js';

const router = new Hono();

/**
 * Content-Type map by file extension.
 */
const CONTENT_TYPES: Record<string, string> = {
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
};

function getContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

/**
 * GET /api/stream/:trackId
 *
 * Stream an audio file with HTTP Range support:
 * - No Range header        → 200 full file
 * - Valid Range            → 206 partial content
 * - Invalid Range          → 416 Range Not Satisfiable
 * - Track not found/gone   → 404
 *
 * Fixes: ETag/Last-Modified, better caching (immutable audio), nosniff,
 *        improved path traversal, proper 416 response.
 */
router.get('/:trackId', async (c) => {
  const trackIdParam = c.req.param('trackId');
  const trackId = Number(trackIdParam);

  // Validate ID
  if (isNaN(trackId)) {
    return c.json({ error: 'Invalid track ID' }, 400);
  }

  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId) as Track | undefined;

  if (!track) {
    return c.json({ error: 'Track not found' }, 404);
  }

  // Path traversal protection: resolve file_path relative to musicDir
  // and enforce strict containment within it.
  const musicDirAbs = pathResolve(env.musicDir!);
  const resolved = pathResolve(musicDirAbs, track.file_path);
  
  // Strict containment check - must be strictly inside musicDir
  if (!resolved.startsWith(musicDirAbs + sep)) {
    logger.warn({ trackId, resolved, musicDirAbs }, 'Path traversal attempt blocked');
    return c.json({ error: 'Not found' }, 404);
  }

  // Check if file exists
  if (!existsSync(resolved)) {
    return c.json({ error: 'Audio file not found' }, 404);
  }

  const stat = statSync(resolved);
  const fileSize = stat.size;
  const contentType = getContentType(resolved);
  
  // Generate ETag from trackId, fileSize, and mtime for cache validation
  const etag = `"${trackId}-${fileSize}-${stat.mtimeMs}"`;
  const lastModified = stat.mtime.toUTCString();

  // Check conditional requests
  const ifNoneMatch = c.req.header('If-None-Match');
  const ifModifiedSince = c.req.header('If-Modified-Since');
  
  if (ifNoneMatch === etag || (ifModifiedSince && new Date(ifModifiedSince) >= stat.mtime)) {
    return new Response(null, { status: 304 });
  }

  const rangeHeader = c.req.header('Range');
  const range = parseRangeHeader(rangeHeader, fileSize);

  if (range.kind === 'none') {
    // 200 full file
    const stream = createReadStream(resolved);
    return new Response(stream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag,
        'Last-Modified': lastModified,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  if (range.kind === 'invalid') {
    // 416 Range Not Satisfiable
    return new Response(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${fileSize}`,
        'Content-Length': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // Valid range → 206 Partial Content
  const { start, end } = range;
  const contentLength = end - start + 1;
  const stream = createReadStream(resolved, { start, end });

  return new Response(stream as any, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Range': formatContentRange(range, fileSize),
      'Content-Length': String(contentLength),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': etag,
      'Last-Modified': lastModified,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

export default router;