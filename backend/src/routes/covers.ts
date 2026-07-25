import { Hono } from 'hono';
import { statSync, existsSync, createReadStream } from 'fs';
import { extname, join, resolve as pathResolve, sep } from 'path';
import { db } from '@/db.js';
import { env } from '@/env.js';

const router = new Hono();

/**
 * Content-Type map for image extensions.
 */
const IMAGE_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function getImageType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return IMAGE_TYPES[ext] || 'application/octet-stream';
}

/**
 * 1×1 transparent SVG placeholder — sent as 200 so <img> never breaks.
 * Rationale: Returning 404/placeholder.png requires the frontend to handle broken images
 * everywhere. Serving a valid SVG with 200 means every <img> tag "just works" without
 * conditional rendering or onerror fallbacks. The SVG is 67 bytes, cached well.
 */
const SVG_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect fill="none" width="1" height="1"/></svg>`;

function svgPlaceholderResponse(): Response {
  return new Response(SVG_PLACEHOLDER, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * Stream a cover file with correct Content-Type.
 */
function streamFile(filePath: string, contentType: string): Response {
  const stream = createReadStream(filePath);
  const stat = statSync(filePath);
  return new Response(stream as any, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * GET /api/covers/artist/:id
 * GET /api/covers/album/:id
 */
router.get('/:type/:id', (c) => {
  const type = c.req.param('type');
  const id = Number(c.req.param('id'));

  let imagePath: string | null | undefined;

  if (type === 'artist') {
    const row = db.prepare('SELECT image_path FROM artists WHERE id = ?').get(id) as { image_path: string | null } | undefined;
    if (!row) return svgPlaceholderResponse();
    imagePath = row.image_path;
  } else if (type === 'album') {
    const row = db.prepare('SELECT cover_path FROM albums WHERE id = ?').get(id) as { cover_path: string | null } | undefined;
    if (!row) return svgPlaceholderResponse();
    imagePath = row.cover_path;
  } else {
    return c.json({ error: 'Invalid cover type. Use "artist" or "album".' }, 400);
  }

  // No image path set → placeholder
  if (!imagePath) {
    return svgPlaceholderResponse();
  }

  // Path traversal protection: resolve imagePath relative to coversDir
  // and enforce containment within it.
  // env.coversDir is guaranteed non-null by env.ts required-env check
  const full = pathResolve(env.coversDir!, imagePath);
  const coversDirAbs = pathResolve(env.coversDir!);
  if (!full.startsWith(coversDirAbs + sep) && full !== coversDirAbs) {
    return svgPlaceholderResponse();
  }

  // File doesn't exist → placeholder
  if (!existsSync(full)) {
    return svgPlaceholderResponse();
  }

  const contentType = getImageType(full);
  return streamFile(full, contentType);
});

export default router;
