/**
 * Player control routes (T11).
 *
 * Routes for controlling audio playback via the ffplay wrapper.
 * JWT pass-through: authMiddleware validates the token (signature-only, no DB lookup).
 *
 * Auth model: Any authenticated user can control the player.
 * Rationale: On a source server, the local ffplay is controlled by the frontend
 * which may be used by any logged-in user. On a dedicated player server, any
 * user with a valid JWT can control playback. Admin-only would be over-restrictive
 * for a shared-family jukebox use case.
 *
 * POST /api/player/play     — { streamUrl: string, title?: string, artist?: string, coverUrl?: string }
 * POST /api/player/pause    — toggle pause
 * POST /api/player/resume   — resume from pause
 * POST /api/player/stop     — stop playback
 * POST /api/player/seek     — { position: number }
 * POST /api/player/volume   — { volume: number } (0–100)
 * GET  /api/player/status   — current player state
 */
import { Hono } from 'hono';
import { authMiddleware } from '../auth.js';
import { Player } from '../player/Player.js';
import { logger } from '../logger.js';

const router = new Hono();

// All player routes require auth
router.use('*', authMiddleware);

const player = Player.getInstance();

/**
 * Validate that a stream URL uses an allowed scheme and is safe to pass to ffplay.
 * Allowed: http:, https:
 * Rejected: file:, data:, and any other scheme (SSRF / local file read protection).
 */
function validateStreamUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'Only http:// and https:// URLs are allowed for playback';
    }
    // Prevent access to local/private IP ranges (basic SSRF mitigation)
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
      hostname === '169.254.169.254' // AWS metadata
    ) {
      return 'Access to local/private addresses is not allowed';
    }
    return null;
  } catch {
    return 'Invalid URL format';
  }
}

/**
 * POST /api/player/play
 * Body: { streamUrl: string }
 * Starts playback of the given URL/file.
 */
router.post('/play', async (c) => {
  let parsed: { streamUrl?: string };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { streamUrl } = parsed;

  if (!streamUrl) {
    return c.json({ error: 'streamUrl is required' }, 400);
  }

  // Validate URL scheme and safety
  const urlError = validateStreamUrl(streamUrl);
  if (urlError) {
    logger.warn({ streamUrl, userId: c.get('user').sub }, 'Rejected unsafe streamUrl');
    return c.json({ error: urlError }, 400);
  }

  const status = player.getStatus();
  if (!status.ffplayAvailable) {
    return c.json({
      error: status.error || 'ffplay not available. Install ffmpeg with SDL support: sudo apt install ffmpeg',
      ffplayAvailable: false,
    }, 400);
  }

  try {
    await player.play(streamUrl);
    return c.json({ message: 'Playback started' }, 202);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * POST /api/player/pause
 * Toggle pause.
 */
router.post('/pause', async (c) => {
  try {
    await player.pause();
    return c.json({ message: 'Paused' }, 202);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * POST /api/player/resume
 * Resume from pause.
 */
router.post('/resume', async (c) => {
  try {
    await player.resume();
    return c.json({ message: 'Resumed' }, 202);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * POST /api/player/stop
 * Stop playback.
 */
router.post('/stop', async (c) => {
  try {
    await player.stop();
    return c.json({ message: 'Stopped' });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * POST /api/player/seek
 * Body: { position: number } — position in seconds.
 */
router.post('/seek', async (c) => {
  let parsed: { position?: number };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { position } = parsed;

  if (position === undefined || position < 0) {
    return c.json({ error: 'position must be a non-negative number' }, 400);
  }

  try {
    await player.seek(position);
    return c.json({ message: `Seeked to ${position}s` }, 202);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * POST /api/player/volume
 * Body: { volume: number } — 0–100.
 */
router.post('/volume', async (c) => {
  let parsed: { volume?: number };
  try {
    parsed = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { volume } = parsed;

  if (volume === undefined || volume < 0 || volume > 100) {
    return c.json({ error: 'volume must be between 0 and 100' }, 400);
  }

  try {
    const result = await player.volume(volume);
    return c.json({ ...result, message: `Volume set to ${volume}%` });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

/**
 * GET /api/player/status
 * Returns current player state.
 */
router.get('/status', (c) => {
  const status = player.getStatus();
  return c.json(status);
});

export default router;