import { Context, Next } from 'hono';

/**
 * Determine if the request path is a player route.
 * Player routes may have tighter CORS restrictions when SOURCE_URL is configured.
 */
function isPlayerRoute(path: string): boolean {
  return path.startsWith('/api/player/');
}

/**
 * Get the allowed origin for player routes.
 * If SOURCE_URL env is set, restrict to that origin only. Otherwise use echo origin behavior.
 */
function getAllowedOriginForPlayer(c: Context): string | null {
  const sourceUrl = process.env.SOURCE_URL;
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      const origin = parsed.origin;
      // Only allow the specific SOURCE_URL origin, not echo
      return origin;
    } catch {
      // Invalid SOURCE_URL — fall through to echo behavior
    }
  }
  return null; // null means use echo origin
}

export function corsMiddleware(): (c: Context, next: Next) => Promise<Response | void> {
  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');
    const path = c.req.path;

    if (isPlayerRoute(path)) {
      // Player routes: if SOURCE_URL is set, restrict to that origin only
      const playerOrigin = getAllowedOriginForPlayer(c);
      if (playerOrigin && origin) {
        if (origin === playerOrigin) {
          c.header('Access-Control-Allow-Origin', origin);
          c.header('Access-Control-Allow-Credentials', 'true');
          c.header('Vary', 'Origin');
        } else {
          // Origin doesn't match — don't set CORS headers (browser will block)
          // Still allow the request to proceed for non-browser clients
        }
      } else {
        // No SOURCE_URL restriction — use standard echo origin
        if (origin) {
          c.header('Access-Control-Allow-Origin', origin);
          c.header('Access-Control-Allow-Credentials', 'true');
          c.header('Vary', 'Origin');
        }
        // If no origin header, don't set * with credentials (browsers reject that)
      }
    } else {
      // Non-player routes: standard echo origin
      if (origin) {
        c.header('Access-Control-Allow-Origin', origin);
        c.header('Access-Control-Allow-Credentials', 'true');
        c.header('Vary', 'Origin');
      }
      // If no origin header, don't set any CORS headers (not a cross-origin request)
    }

    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Range');
    c.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

    if (c.req.method === 'OPTIONS') {
      return c.newResponse(null, 200);
    }

    await next();
  };
}