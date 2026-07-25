import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set test env vars before any test modules load (vitest.config.ts runs first)
// These must be set before env.ts is imported by db.ts
process.env.PORT = '3001';
process.env.MUSIC_DIR = '/tmp/harmonix-test-music';
process.env.DB_PATH = '/tmp/harmonix-test.db';
process.env.COVERS_DIR = '/tmp/harmonix-test-covers/';
process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-here!';
process.env.ROLE = 'source';
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    fileParallelism: false,
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    env: {
      NODE_ENV: 'test',
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
});