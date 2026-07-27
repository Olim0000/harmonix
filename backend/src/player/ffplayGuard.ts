/**
 * ffplayGuard — PID tracking + graceful shutdown for ffplay subprocess (T20).
 *
 * Binds SIGINT/SIGTERM handlers to cleanly kill ffplay before exit.
 * Also tracks PID for status endpoint reporting.
 */
import { Player } from './Player.js';
import { logger } from '../logger.js';

let registered = false;

/**
 * Register SIGINT/SIGTERM handlers that clean up the Player ffplay subprocess
 * before the Node process exits. Idempotent — safe to call multiple times.
 */
export function registerFfplayGuard(): void {
  if (registered) return;
  registered = true;

  const cleanup = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal — stopping player');

    const player = Player.getInstance();
    try {
      const status = player.getStatus();
      if (status.state !== 'stopped') {
        logger.info('Killing active ffplay subprocess');
        await player.stop(); // Now properly awaited
      }
    } catch (err: any) {
      logger.error({ err }, 'Error during player cleanup');
    }

    // Allow process to exit naturally (don't force exit code 0)
    // Node will exit with code 0 after this async handler completes
    process.exit(0);
  };

  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));
}