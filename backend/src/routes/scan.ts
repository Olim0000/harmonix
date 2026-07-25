/**
 * Scan job + SSE progress route (T09).
 *
 * POST /api/admin/scan   — triggers a background scan
 * GET /api/admin/scan/stream — SSE stream of scan progress
 */
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware, requireAdmin } from '../auth.js';
import { env } from '../env.js';
import { db } from '../db.js';
import { scanMusicDir, type ScanProgress, type ScanJob } from '../player/scanner.js';
import { logger } from '../logger.js';

const router = new Hono();

// All scan routes require auth + admin
router.use('*', authMiddleware, requireAdmin);

// Active scan job reference (singleton per process)
let activeJob: ScanJob | null = null;

/**
 * Get the active scan job (for test access, Fix M5).
 * Returns null if no scan is running.
 */
export function getActiveJob(): ScanJob | null {
  return activeJob;
}

/**
 * POST /api/admin/scan
 * Triggers a background scan of the music directory.
 * Returns 202 if scan started, 409 if already running.
 */
router.post('/scan', async (c) => {
  if (activeJob) {
    return c.json({ error: 'Scan already in progress' }, 409);
  }

  if (!env.musicDir) {
    return c.json({ error: 'MUSIC_DIR not configured' }, 400);
  }

  const job = scanMusicDir(env.musicDir, db);
  activeJob = job;

  // Clear reference when job completes or fails
  job.promise
    .then(() => {
      activeJob = null;
    })
    .catch((err: any) => {
      logger.error({ err }, 'Scan job failed');
      activeJob = null;
    });

  return c.json({
    message: 'Scan started',
    scanned: 0,
    total: 0,
  }, 202);
});

/**
 * GET /api/admin/scan/stream
 * SSE endpoint that streams scan progress events.
 * Sends progress event every ~500ms while scan runs,
 * then a 'done' event when scan completes.
 */
router.get('/scan/stream', async (c) => {
  if (!activeJob) {
    return c.json({ error: 'No scan in progress' }, 404);
  }

  return streamSSE(c, async (stream) => {
    // Fix H2: detect client disconnect and break the loop
    let cancelled = false;
    stream.onAbort(() => { cancelled = true; });

    // Send initial progress immediately
    const initialStatus = activeJob!.getStatus();
    await stream.writeSSE({
      event: 'progress',
      data: JSON.stringify(initialStatus),
    });

    // Poll for updates until scan completes or client disconnects
    while (activeJob && activeJob.isRunning() && !cancelled) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (cancelled) break;
      const status = activeJob!.getStatus();
      await stream.writeSSE({
        event: 'progress',
        data: JSON.stringify(status),
      });
    }

    // Send final status if not cancelled
    if (!cancelled) {
      if (activeJob) {
        const finalStatus = activeJob.getStatus();
        await stream.writeSSE({
          event: 'progress',
          data: JSON.stringify(finalStatus),
        });
      }

      // Send done event
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({}),
      });
    }
  });
});

export default router;
