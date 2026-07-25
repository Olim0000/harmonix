/**
 * Global vitest setup — runs once before ALL tests.
 * Cleans up the test database and other temp dirs from previous runs.
 */
import { rmSync, existsSync, mkdirSync } from 'fs';

export function setup(): void {
  // Remove and recreate the test DB path
  const dbPath = '/tmp/harmonix-test.db';
  if (existsSync(dbPath)) {
    rmSync(dbPath, { force: true });
  }
  // Remove WAL/SHM files
  if (existsSync(dbPath + '-wal')) {
    rmSync(dbPath + '-wal', { force: true });
  }
  if (existsSync(dbPath + '-shm')) {
    rmSync(dbPath + '-shm', { force: true });
  }

  // Ensure test directories exist
  mkdirSync('/tmp/harmonix-test-covers', { recursive: true });
  mkdirSync('/tmp/harmonix-test-music', { recursive: true });
}

export function teardown(): void {
  // No cleanup needed after tests
}
