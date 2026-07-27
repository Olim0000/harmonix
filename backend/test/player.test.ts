/**
 * Player ffplay wrapper integration tests (T10, T20).
 *
 * These tests use the real ffplay binary to verify subprocess lifecycle:
 * - spawn, pause via stdin 'p', resume via stdin 'p', stop, seek, volume
 * - missing-ffplay graceful degradation
 * - status reporting (ffplayAvailable, state, position)
 *
 * Since we can't easily capture audio output, we assert on process state
 * transitions and status endpoint responses.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { join } from 'path';
import { realpathSync } from 'fs';

const FIXTURES_DIR = join(realpathSync('.'), 'test', 'fixtures');
const silenceWav = join(FIXTURES_DIR, 'silence.wav');

// We import after ensuring fixture exists
let Player: any;
let player: any;

beforeAll(async () => {
  const mod = await import('@/player/Player.js');
  Player = mod.Player;
});

beforeEach(async () => {
  // Get singleton instance — each test gets a fresh reset
  player = Player.getInstance();
  await player.reset();
});

afterAll(() => {
  player.stop();
});

describe('Player singleton', () => {
  it('starts in stopped state with ffplayAvailable', () => {
    const status = player.getStatus();
    expect(status.state).toBe('stopped');
    expect(typeof status.ffplayAvailable).toBe('boolean');
  });
});

describe('Player.play()', () => {
  it('spawns ffplay and transitions to playing state', async () => {
    await player.play(silenceWav);
    const status = player.getStatus();
    expect(status.state).toBe('playing');
    expect(status.ffplayAvailable).toBe(true);
  });

  it('returns status with currentUrl set after play', async () => {
    await player.play(silenceWav);
    const status = player.getStatus();
    expect(status.currentUrl).toBe(silenceWav);
  });

  it('rejects with error for non-existent file', async () => {
    await expect(player.play('/nonexistent/file.mp3')).rejects.toThrow();
  });
});

describe('Player.pause() and resume()', () => {
  it('pauses playback via stdin p', async () => {
    await player.play(silenceWav);
    await player.pause();
    const status = player.getStatus();
    expect(status.state).toBe('paused');
  });

  it('resumes playback via stdin p', async () => {
    await player.play(silenceWav);
    await player.pause();
    const status1 = player.getStatus();
    expect(status1.state).toBe('paused');

    await player.resume();
    const status2 = player.getStatus();
    expect(status2.state).toBe('playing');
  });

  it('pause returns error when nothing is playing', async () => {
    await expect(player.pause()).rejects.toThrow(/No track is playing/i);
  });

  it('position does not drift backward after pause/resume (Fix C4)', async () => {
    await player.play(silenceWav);
    // Let playback run for ~2s so position is measurably > 0
    await new Promise((r) => setTimeout(r, 2000));
    const posBeforePause = player.getStatus().position;
    expect(posBeforePause).toBeGreaterThanOrEqual(1);

    await player.pause();
    // Stay paused for 1s
    await new Promise((r) => setTimeout(r, 1000));
    await player.resume();

    const posAfterResume = player.getStatus().position;
    // Without fix, posAfterResume would be ~0 (drift backward by ~2s).
    // With fix, it should be approximately posBeforePause (±1s due to integer-second
    // resolution of calculatePosition which uses Math.floor).
    const drift = posAfterResume - posBeforePause;
    expect(Math.abs(drift)).toBeLessThanOrEqual(1);
  });
});

describe('Player.stop()', () => {
  it('stops playback and transitions to stopped', async () => {
    await player.play(silenceWav);
    await player.stop();
    const status = player.getStatus();
    expect(status.state).toBe('stopped');
    expect(status.currentUrl).toBeNull();
  });

  it('is idempotent when already stopped', async () => {
    await player.stop(); // already stopped
    const status = player.getStatus();
    expect(status.state).toBe('stopped');
  });
});

describe('Player.seek()', () => {
  it('seeks to a valid position', async () => {
    await player.play(silenceWav);
    await player.seek(0);
    const status = player.getStatus();
    expect(status.state).toBe('playing');
  });

  it('rejects for negative position', async () => {
    await expect(player.seek(-1)).rejects.toThrow();
  });
});

describe('Player.volume()', () => {
  it('sets volume to valid percentage', async () => {
    const result = await player.volume(75);
    // Volume may succeed or fail depending on pactl availability
    // The method should not throw — Fix H4: returns { success: boolean }
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  it('rejects for out-of-range volume', async () => {
    await expect(player.volume(-1)).rejects.toThrow();
    await expect(player.volume(101)).rejects.toThrow();
  });
});

describe('Player status', () => {
  it('includes expected fields in status object', async () => {
    await player.play(silenceWav);
    const status = player.getStatus();
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('ffplayAvailable');
    expect(status).toHaveProperty('currentUrl');
    expect(status).toHaveProperty('position');
  });
});

describe('Missing ffplay binary', () => {
  it('reports ffplayAvailable=false with graceful error', async () => {
    // Reset singleton with a fake binary path
    await player.reset('/nonexistent/ffplay_xyz');
    const status = player.getStatus();
    expect(status.ffplayAvailable).toBe(false);
    expect(status.error).toContain('ffplay');
  });

  it('play returns error when ffplay missing', async () => {
    // Reset singleton with a fake binary path
    await player.reset('/nonexistent/ffplay_xyz');
    await expect(player.play(silenceWav)).rejects.toThrow(/ffplay/i);
  });
});

// Restore singleton for other tests (if any run after)
afterAll(() => {
  player.reset();
});
