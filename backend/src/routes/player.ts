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

const router = new Hono();

// All player routes require auth
router.use('*', authMiddleware);

const player = Player.getInstance();

/**
 * POST /api/player/play
 * Body: { streamUrl: string }
 * Starts playback of the given URL/file.
 */
router.post('/play', async (c) => {
  const { streamUrl } = await c.req.json<{ streamUrl: string }>();

  if (!streamUrl) {
    return c.json({ error: 'streamUrl is required' }, 400);
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
  const { position } = await c.req.json<{ position: number }>();

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
  const { volume } = await c.req.json<{ volume: number }>();

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
