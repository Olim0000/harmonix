/**
 * Player — singleton ffplay subprocess wrapper.
 *
 * Manages a single ffplay process for audio playback:
 * - spawn with `-nodisp -autoexit -loglevel error` (not quiet, so we can detect errors)
 * - stdin `p` toggles pause (but we track state carefully)
 * - SIGTERM + respawn with `-ss <pos>` for seek
 * - pactl/amixer for volume (async, non-blocking)
 * - position tracking via wall-clock + seekOffset (1s interval)
 * - process exit → clear state + emit 'trackEnd'
 *
 * Fixes: false-success on ENOENT, pause/resume desync, race conditions, proper cleanup.
 */
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { promisify } from 'util';

export type PlayerState = 'stopped' | 'playing' | 'paused';

export interface PlayerStatus {
  state: PlayerState;
  ffplayAvailable: boolean;
  currentUrl: string | null;
  position: number; // seconds (wall-clock estimate)
  error?: string;
  pid?: number | null;
}

export class Player extends EventEmitter {
  private static instance: Player | null = null;

  private process: ChildProcess | null = null;
  private binaryPath: string;
  private state: PlayerState = 'stopped';
  private currentUrl: string | null = null;
  private positionInterval: ReturnType<typeof setInterval> | null = null;
  private position: number = 0;
  private seekOffset: number = 0;
  private startedAt: number = 0;
  private ffplayAvailable: boolean = true;
  private error: string | undefined;
  /** Generation counter: incremented each spawn so stale exit handlers don't clobber new process state. */
  private generation: number = 0;
  /** Serializes ALL mutating commands to prevent races between rapid calls. */
  private commandLock: Promise<void> = Promise.resolve();

  /**
   * @param binaryPath — override for ffplay binary path (default 'ffplay').
   * Uses FFPLAY_PATH env var if set, passed argument otherwise.
   */
  private constructor(binaryPath?: string) {
    super();
    this.binaryPath = binaryPath || process.env.FFPLAY_PATH || 'ffplay';
    this.checkFfplay();
  }

  /**
   * Get the singleton Player instance.
   * @param binaryPath — optional override (only effective on first call or after reset).
   */
  static getInstance(binaryPath?: string): Player {
    if (!Player.instance) {
      Player.instance = new Player(binaryPath);
    }
    return Player.instance;
  }

  /**
   * Check if the ffplay binary is available on PATH.
   * Non-blocking async check; called periodically to auto-recover.
   */
  private async checkFfplay(): Promise<void> {
    try {
      const result = await this.spawnAsync(this.binaryPath, ['-version'], {
        stdio: 'pipe',
        timeout: 5000,
      });
      this.ffplayAvailable = result.status === 0;
      if (!this.ffplayAvailable) {
        this.error = `ffplay not found at "${this.binaryPath}". Install ffmpeg with SDL support: sudo apt install ffmpeg`;
      } else {
        this.error = undefined;
      }
    } catch {
      this.ffplayAvailable = false;
      this.error = `ffplay not found at "${this.binaryPath}". Install ffmpeg with SDL support: sudo apt install ffmpeg`;
    }
  }

  /**
   * Async wrapper for spawnSync.
   */
  private spawnAsync(
    command: string,
    args: string[],
    options: { stdio: 'pipe' | 'ignore' | 'inherit'; timeout?: number } = { stdio: 'pipe' }
  ): Promise<{ status: number | null }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, options);
      let timedOut = false;
      const timeout = options.timeout ? setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
        reject(new Error('Command timed out'));
      }, options.timeout) : null;

      child.on('exit', (code) => {
        if (timeout) clearTimeout(timeout);
        if (timedOut) return;
        resolve({ status: code });
      });

      child.on('error', (err) => {
        if (timeout) clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Serialize all mutating commands.
   */
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.commandLock;
    let releaseLock: () => void;
    this.commandLock = new Promise<void>((r) => { releaseLock = r; });
    try {
      return await fn();
    } finally {
      releaseLock!();
    }
  }

  /**
   * Start playback of the given URL/file.
   * Only allows http/https URLs (validated at route level).
   */
  async play(url: string): Promise<void> {
    return this.withLock(async () => {
      if (!this.ffplayAvailable) {
        await this.checkFfplay(); // try to re-probe
        if (!this.ffplayAvailable) {
          throw new Error(this.error || 'ffplay not available');
        }
      }

      // Kill existing process first
      await this.killProcess();

      // For local file playback, verify the file exists
      if (url.startsWith('file://')) {
        const filePath = url.slice(7);
        if (!existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
      } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:')) {
        // Treat as local file path
        if (!existsSync(url)) {
          throw new Error(`File not found: ${url}`);
        }
      }

      return new Promise<void>((resolve, reject) => {
        try {
          this.generation++;
          const gen = this.generation;

          this.process = spawn(this.binaryPath, [
            '-nodisp',
            '-autoexit',
            '-loglevel', 'error',
            url,
          ], {
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          this.state = 'playing';
          this.currentUrl = url;
          this.seekOffset = 0;
          this.startedAt = Date.now();

          // Handle process exit (e.g. autoexit, or manual stop)
          // Guard by generation so stale handlers don't clobber a newer process.
          this.process.on('exit', (code, signal) => {
            if (gen !== this.generation) return; // stale
            this.stopPositionTracking();
            this.process = null;
            this.state = 'stopped';
            // Keep currentUrl for status reporting after track ends
            this.position = 0;
            this.seekOffset = 0;
            this.error = undefined;
            this.emit('trackEnd', { code, signal });
          });

          this.process.on('error', (err) => {
            if (gen !== this.generation) return; // stale
            this.ffplayAvailable = false;
            this.error = err.message;
            this.state = 'stopped';
            this.process = null;
            this.stopPositionTracking();
            reject(err);
          });

          // Capture stderr to detect immediate failures
          let stderr = '';
          this.process.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
          });

          // Wait briefly to confirm the process started without immediate failure
          const checkStarted = () => {
            if (gen !== this.generation) return; // stale — newer process has taken over

            if (this.process === null) {
              if (this.state === 'stopped') {
                // Process exited on its own (autoexit for short file) — OK
                resolve();
              } else {
                reject(new Error(this.error || 'Failed to start ffplay'));
              }
              return;
            }
            if (this.process.exitCode !== null) {
              // Process exited immediately — likely an error
              const errMsg = stderr.trim() || `ffplay exited immediately with code ${this.process.exitCode}`;
              reject(new Error(errMsg));
              return;
            }
            // Process is running
            this.startPositionTracking();
            resolve();
          };

          // Use setImmediate to let stderr accumulate
          setImmediate(() => setTimeout(checkStarted, 300));
        } catch (err: any) {
          this.ffplayAvailable = false;
          this.error = err.message;
          reject(err);
        }
      });
    });
  }

  /**
   * Pause playback via stdin 'p'.
   * We track state carefully to avoid desync: write 'p', then update state.
   * If write fails (EPIPE), we transition to stopped.
   */
  async pause(): Promise<void> {
    return this.withLock(async () => {
      if (this.state === 'stopped') {
        throw new Error('No track is playing');
      }
      if (this.state === 'paused') {
        return; // already paused
      }

      if (this.process && this.process.stdin) {
        // Capture current position before stopping tracking
        this.seekOffset = this.calculatePosition();
        this.stopPositionTracking();

        try {
          this.process.stdin.write('p');
          // Don't assume it worked immediately; state will be confirmed by position tracking
          // but we optimistically set paused; if ffplay didn't receive it, position tracking
          // will reveal the desync (position will keep advancing)
          this.state = 'paused';
        } catch {
          // Process gone (EPIPE) — transition to stopped
          this.state = 'stopped';
          this.process = null;
          this.currentUrl = null;
          this.position = 0;
          this.seekOffset = 0;
          throw new Error('Playback process ended unexpectedly');
        }
      } else {
        throw new Error('No active ffplay process');
      }
    });
  }

  /**
   * Resume playback via stdin 'p' toggle.
   * Restarts position tracking with seekOffset as base.
   */
  async resume(): Promise<void> {
    return this.withLock(async () => {
      if (this.state === 'stopped') {
        throw new Error('No track is playing');
      }
      if (this.state === 'playing') {
        return; // already playing
      }

      if (this.process && this.process.stdin) {
        try {
          this.process.stdin.write('p');
          this.state = 'playing';
          this.startedAt = Date.now(); // reset wall clock; seekOffset holds paused-at position
          this.startPositionTracking();
        } catch {
          // Process gone (EPIPE) — transition to stopped
          this.state = 'stopped';
          this.process = null;
          this.currentUrl = null;
          this.position = 0;
          this.seekOffset = 0;
          throw new Error('Playback process ended unexpectedly');
        }
      } else {
        throw new Error('No active ffplay process');
      }
    });
  }

  /**
   * Stop playback: SIGTERM then SIGKILL fallback, clear state.
   * Awaits process exit before resolving.
   */
  async stop(): Promise<void> {
    return this.withLock(async () => {
      await this.killProcess();
      this.state = 'stopped';
      this.currentUrl = null;
      this.position = 0;
      this.seekOffset = 0;
      this.error = undefined;
    });
  }

  /**
   * Seek by killing current ffplay and respawning with -ss <position>.
   * Preserves pause state correctly.
   */
  async seek(position: number): Promise<void> {
    return this.withLock(async () => {
      if (!this.currentUrl) {
        throw new Error('No track is playing');
      }
      if (position < 0) {
        throw new Error('Position must be non-negative');
      }

      const wasPaused = this.state === 'paused';
      const url = this.currentUrl;

      // Kill current process and wait for it to fully exit
      await this.killProcess();

      // Update seek offset
      this.seekOffset = position;
      this.position = position;

      // Respawn with -ss
      return new Promise<void>((resolve, reject) => {
        try {
          this.generation++;
          const gen = this.generation;

          this.process = spawn(this.binaryPath, [
            '-ss', String(position),
            '-nodisp',
            '-autoexit',
            '-loglevel', 'error',
            url,
          ], {
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          // Start in the correct state: if was paused, we'll send 'p' after confirming start
          this.state = wasPaused ? 'paused' : 'playing';
          this.startedAt = Date.now();

          let stderr = '';
          this.process.stderr?.on('data', (chunk) => {
            stderr += chunk.toString();
          });

          this.process.on('exit', (code, signal) => {
            if (gen !== this.generation) return; // stale
            this.stopPositionTracking();
            this.process = null;
            this.state = 'stopped';
            this.currentUrl = null;
            this.position = 0;
            this.seekOffset = 0;
            this.emit('trackEnd', { code, signal });
          });

          this.process.on('error', (err) => {
            if (gen !== this.generation) return; // stale
            this.ffplayAvailable = false;
            this.error = err.message;
            this.state = 'stopped';
            this.process = null;
            this.stopPositionTracking();
            reject(err);
          });

          const checkStarted = () => {
            if (gen !== this.generation) return; // stale

            if (this.process === null) {
              if (this.state === 'stopped') {
                resolve(); // played and finished too fast — OK
              } else {
                reject(new Error('Failed to restart ffplay for seek'));
              }
              return;
            }
            if (this.process.exitCode !== null) {
              const errMsg = stderr.trim() || 'ffplay exited immediately after seek';
              reject(new Error(errMsg));
              return;
            }
            // Process is running — if we need it paused, send 'p' now
            if (wasPaused && this.process && this.process.stdin) {
              try {
                this.process.stdin.write('p');
              } catch {
                // If write fails, we'll catch it on next command
              }
            }
            this.startPositionTracking();
            resolve();
          };

          setImmediate(() => setTimeout(checkStarted, 300));
        } catch (err: any) {
          reject(err);
        }
      });
    });
  }

  /**
   * Set volume via pactl with amixer fallback.
   * Uses async spawn to avoid blocking the event loop.
   * @param percent — 0–100
   * @returns { success: boolean }
   */
  async volume(percent: number): Promise<{ success: boolean }> {
    if (percent < 0 || percent > 100) {
      throw new Error('Volume must be between 0 and 100');
    }

    // Primary: pactl (async)
    try {
      const result = await this.spawnAsync('pactl', [
        'set-sink-volume', '@DEFAULT_SINK@', `${percent}%`,
      ], { stdio: 'pipe', timeout: 3000 });
      if (result.status === 0) return { success: true };
    } catch {
      // Fall through to amixer fallback
    }

    // Fallback: amixer (async)
    try {
      const result = await this.spawnAsync('amixer', [
        'sset', 'Master', `${percent}%`,
      ], { stdio: 'pipe', timeout: 3000 });
      return { success: result.status === 0 };
    } catch {
      return { success: false };
    }
  }

  /**
   * Get current player status.
   */
  getStatus(): PlayerStatus {
    return {
      state: this.state,
      ffplayAvailable: this.ffplayAvailable,
      currentUrl: this.currentUrl,
      position: this.calculatePosition(),
      error: this.error,
      pid: this.process?.pid ?? null,
    };
  }

  /**
   * Reset the player to initial state (for testing).
   * Optionally override binaryPath for next check.
   */
  async reset(binaryPath?: string): Promise<void> {
    await this.killProcess();
    this.state = 'stopped';
    this.currentUrl = null;
    this.position = 0;
    this.seekOffset = 0;
    this.error = undefined;
    if (binaryPath !== undefined) {
      this.binaryPath = binaryPath;
    }
    await this.checkFfplay();
  }

  /**
   * Calculate current playback position based on wall clock.
   */
  private calculatePosition(): number {
    if (this.state === 'stopped') return 0;
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    return this.seekOffset + elapsed;
  }

  /**
   * Start 1s interval to update position estimate.
   * Uses unref so it doesn't keep the event loop alive.
   */
  private startPositionTracking(): void {
    this.stopPositionTracking();
    this.position = this.seekOffset;
    this.positionInterval = setInterval(() => {
      this.position = this.calculatePosition();
    }, 1000);
    // Don't keep process alive for position tracking
    if (this.positionInterval && typeof (this.positionInterval as any).unref === 'function') {
      (this.positionInterval as any).unref();
    }
  }

  /**
   * Stop position tracking interval.
   */
  private stopPositionTracking(): void {
    if (this.positionInterval) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }
  }

  /**
   * Kill the ffplay subprocess.
   * SIGTERM first, then SIGKILL after 2s fallback.
   * Returns a Promise that resolves when the process has exited.
   */
  private async killProcess(): Promise<void> {
    if (!this.process) return;

    this.stopPositionTracking();
    this.generation++; // invalidate any pending exit/error handlers

    const proc = this.process;
    this.process = null;

    try {
      proc.stdin?.end();
    } catch {
      // best-effort
    }

    // If already exited, resolve immediately
    if (proc.exitCode !== null || proc.killed) {
      return;
    }

    return new Promise<void>((resolve) => {
      proc.once('exit', () => {
        clearTimeout(fallbackTimer);
        resolve();
      });

      proc.kill('SIGTERM');

      // Fallback: SIGKILL after 2 seconds if process hasn't exited
      const fallbackTimer = setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // already dead
        }
      }, 2000);
      fallbackTimer.unref?.();
    });
  }
}