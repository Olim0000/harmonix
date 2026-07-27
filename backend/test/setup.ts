import { beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { mkdtempSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { corsMiddleware } from '@/cors.js';
import { db, applySchema } from '@/db.js';

// Fixture directory for static test files (e.g. audio.mp3, cover images)
const TEST_FIXTURES_DIR = join(realpathSync('.'), 'test', 'fixtures');

// Ensure fixture directory and static files exist exactly once
beforeAll(() => {
  if (!existsSync(TEST_FIXTURES_DIR)) {
    mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
  }
  const audioPath = join(TEST_FIXTURES_DIR, 'audio.mp3');
  if (!existsSync(audioPath)) {
    writeFileSync(audioPath, Buffer.alloc(1024)); // 1KB of zeros
  }
  const silencePath = join(TEST_FIXTURES_DIR, 'silence.wav');
  if (!existsSync(silencePath)) {
    // Create a minimal valid WAV file (44-byte header + 1 second of silence at 44.1kHz mono)
    const sampleRate = 44100;
    const numChannels = 1;
    const bitsPerSample = 16;
    const duration = 1; // seconds
    const numSamples = sampleRate * duration;
    const dataSize = numSamples * numChannels * (bitsPerSample / 8);
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // PCM format chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byte rate
    header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // block align
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    const data = Buffer.alloc(dataSize); // zeros = silence
    writeFileSync(silencePath, Buffer.concat([header, data]));
  }

  // Apply schema to the test DB singleton once for the entire test run.
  // Each test file is responsible for cleaning its own data.
  applySchema(db);
});

// Track temporary directories/databases for cleanup
const tempPaths: string[] = [];
const tempDbs: Database.Database[] = [];

afterAll(() => {
  for (const db of tempDbs) {
    try { db.close(); } catch { /* best-effort */ }
  }
  for (const p of tempPaths) {
    try {
      rmSync(p, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

export function getFixturesDir(): string {
  return TEST_FIXTURES_DIR;
}

/**
 * Create a fresh better-sqlite3 Database backed by a unique temporary file,
 * with the full schema applied. Callers own cleanup responsibility.
 */
export function createTestDb(): Database.Database {
  const tmpDir = mkdtempSync(join(tmpdir(), 'harmonix-test-'));
  tempPaths.push(tmpDir);
  const dbPath = join(tmpDir, 'test.db');

  const database = new Database(dbPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  applySchema(database);
  tempDbs.push(database);
  return database;
}

/**
 * Close a test database and clean up its resources.
 */
export function closeTestDb(database: Database.Database): void {
  try {
    database.close();
  } catch {
    // best-effort
  }
  // Note: temp dir cleanup happens in afterAll
}

/**
 * Build a Hono app wired with CORS middleware.
 * Tests mount their own routes on the returned app.
 *
 * Note: We import authMiddleware but don't mount it globally;
 * each test mounts authMiddleware on the routes that require it via c.var.user.
 * The authMiddleware uses verifyToken from jwt.ts which is signature-only
 * (no database needed).
 */
export function createTestApp(): Hono {
  const app = new Hono();
  app.use('*', corsMiddleware());
  return app;
}