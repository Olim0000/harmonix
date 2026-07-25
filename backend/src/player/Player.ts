/**
 * Player — singleton ffplay subprocess wrapper.
 *
 * Manages a single ffplay process for audio playback:
 * - spawn with `-nodisp -autoexit -loglevel quiet`
 * - stdin `p` toggles pause
 * - SIGTERM + respawn with `-ss <pos>` for seek
 * - pactl/amixer for volume
 * - position tracking via wall-clock + seekOffset (1s interval)
 * - process exit → clear state + emit 'trackEnd'
 *
 * T10 + T20 (minimum viable hardening).
 */
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';

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
  /** Serializes play() calls to prevent race between rapid consecutive plays. */
  private playLock: Promise<void> = Promise.resolve();

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
   */
  private checkFfplay(): void {
    try {
      const result = spawnSync(this.binaryPath, ['-version'], {
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
   * Start playback of the given URL/file.
   */
  async play(url: string): Promise<void> {
    // Serialize play calls to prevent race between rapid consecutive plays
    await this.playLock;
    let releaseLock: () => void;
    this.playLock = new Promise<void>(r => { releaseLock = r; });

    try {
      if (!this.ffplayAvailable) {
        throw new Error(this.error || 'ffplay not available');
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
            '-loglevel', 'quiet',
            url,
          ], {
            stdio: ['pipe', 'ignore', 'ignore'],
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
            this.currentUrl = null;
            this.position = 0;
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

          // Wait briefly to confirm the process started without immediate failure
          const checkStarted = () => {
            if (gen !== this.generation) return; // stale — newer process has taken over

            if (this.process === null) {
              if (this.state === 'stopped') {
                // Process exited on its own (autoexit for short file)
                // That's OK — the playback did happen
                resolve();
              } else {
                reject(new Error(this.error || 'Failed to start ffplay'));
              }
              return;
            }
            if (this.process.exitCode !== null) {
              // Process exited immediately — likely an error
              reject(new Error(`ffplay exited immediately with code ${this.process.exitCode}`));
              return;
            }
            // Process is running
            this.startPositionTracking();
            resolve();
          };

          setTimeout(checkStarted, 300);
        } catch (err: any) {
          this.ffplayAvailable = false;
          this.error = err.message;
          reject(err);
        }
      });
    } finally {
      releaseLock!();
    }
  }

  /**
   * Toggle pause via stdin 'p'.
   * ffplay accepts 'p' on stdin to toggle pause without losing internal clock.
   *
   * Fix C3 — stdin.write wrapped in try/catch for EPIPE.
   * Fix C4 — captures current position into seekOffset before stopping tracking
   *           so resume() calculates correct wall-clock position.
   */
  async pause(): Promise<void> {
    if (this.state === 'stopped') {
      throw new Error('No track is playing');
    }
    if (this.state === 'paused') {
      return; // already paused
    }

    if (this.process && this.process.stdin) {
      // Fix C4: capture current position before stopping tracking
      this.seekOffset = this.calculatePosition();
      this.stopPositionTracking();
      // Fix C3: stdin EPIPE handling
      try {
        this.process.stdin.write('p');
        this.state = 'paused';
      } catch {
        // Process gone (EPIPE) — transition to stopped
        this.state = 'stopped';
        this.process = null;
        this.currentUrl = null;
        this.position = 0;
        this.seekOffset = 0;
      }
    } else {
      throw new Error('No active ffplay process');
    }
  }

  /**
   * Resume playback via stdin 'p' toggle.
   *
   * Fix C3 — stdin.write wrapped in try/catch for EPIPE.
   * Fix C4 — starts position tracking; seekOffset (captured in pause())
   *           provides the correct wall-clock base.
   */
  async resume(): Promise<void> {
    if (this.state === 'stopped') {
      throw new Error('No track is playing');
    }
    if (this.state === 'playing') {
      return; // already playing
    }

    if (this.process && this.process.stdin) {
      // Fix C3: stdin EPIPE handling
      try {
        this.process.stdin.write('p');
        this.state = 'playing';
        this.startedAt = Date.now(); // reset wall clock; seekOffset holds paused-at position
        this.startPositionTracking(); // Fix C4: restart position tracking
      } catch {
        // Process gone (EPIPE) — transition to stopped
        this.state = 'stopped';
        this.process = null;
        this.currentUrl = null;
        this.position = 0;
        this.seekOffset = 0;
      }
    } else {
      throw new Error('No active ffplay process');
    }
  }

  /**
   * Stop playback: SIGTERM then SIGKILL fallback, clear state.
   */
  async stop(): Promise<void> {
    this.killProcess();
    this.state = 'stopped';
    this.currentUrl = null;
    this.position = 0;
    this.seekOffset = 0;
  }

  /**
   * Seek by killing current ffplay and respawning with -ss <position>.
   */
  async seek(position: number): Promise<void> {
    if (!this.currentUrl) {
      throw new Error('No track is playing');
    }
    if (position < 0) {
      throw new Error('Position must be non-negative');
    }

    const wasPaused = this.state === 'paused';
    const url = this.currentUrl;

    // Kill current process and wait for it to fully exit (Fix C2)
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
          '-loglevel', 'quiet',
          url,
        ], {
          stdio: ['pipe', 'ignore', 'ignore'],
        });

        this.state = wasPaused ? 'paused' : 'playing';
        this.startedAt = Date.now();

        this.process.on('exit', (code, signal) => {
          if (gen !== this.generation) return; // stale
          this.stopPositionTracking();
          this.process = null;
          this.state = 'stopped';
          this.currentUrl = null;
          this.position = 0;
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
            reject(new Error('ffplay exited immediately after seek'));
            return;
          }
          this.startPositionTracking();
          resolve();
        };

        setTimeout(checkStarted, 300);
      } catch (err: any) {
        reject(err);
      }
    });
  }

  /**
   * Set volume via pactl with amixer fallback.
   * @param percent — 0–100
   * @returns { success: boolean } — Fix H4: spec contract requires object shape.
   */
  async volume(percent: number): Promise<{ success: boolean }> {
    if (percent < 0 || percent > 100) {
      throw new Error('Volume must be between 0 and 100');
    }

    // Primary: pactl
    try {
      const result = spawnSync('pactl', [
        'set-sink-volume', '@DEFAULT_SINK@', `${percent}%`,
      ], { timeout: 3000, stdio: 'pipe' });
      if (result.status === 0) return { success: true };
    } catch {
      // Fall through to amixer fallback
    }

    // Fallback: amixer
    try {
      const result = spawnSync('amixer', [
        'sset', 'Master', `${percent}%`,
      ], { timeout: 3000, stdio: 'pipe' });
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
  reset(binaryPath?: string): void {
    this.killProcess();
    this.state = 'stopped';
    this.currentUrl = null;
    this.position = 0;
    this.seekOffset = 0;
    this.error = undefined;
    if (binaryPath !== undefined) {
      this.binaryPath = binaryPath;
    }
    this.checkFfplay();
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
   */
  private startPositionTracking(): void {
    this.stopPositionTracking();
    this.position = this.seekOffset;
    this.positionInterval = setInterval(() => {
      this.position = this.calculatePosition();
    }, 1000);
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
   * Fix C2 — seek race: callers can await to ensure old process is gone before respawn.
   */
  private killProcess(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.process) return resolve();

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
        return resolve();
      }

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
    });
  }
}
