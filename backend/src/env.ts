import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from the project root (2 levels up from backend/src/env.ts)
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..');
config({ path: resolve(projectRoot, '.env') });

// Also try cwd for `cd backend && npx tsx src/index.ts` usage
config({ path: resolve(process.cwd(), '.env') });

const requiredEnv = [
  'PORT',
  'MUSIC_DIR',
  'DB_PATH',
  'COVERS_DIR',
  'JWT_SECRET',
  // ROLE is optional (defaults to 'source'), validated below
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

/**
 * Validate ROLE environment variable.
 * Exported for direct testing (same pattern as validateJwtSecret).
 * Fix M4: ensures ROLE is one of the allowed values.
 */
export function validateRole(role: string): void {
  if (!['source', 'player'].includes(role)) {
    throw new Error(`ROLE must be "source" or "player" (got: "${role}")`);
  }
}

// Fix M4: validate ROLE enum — default 'source' if not set
const role = process.env.ROLE || 'source';
validateRole(role);

/**
 * Known default JWT secrets that must never be used in production.
 * If any of these are detected, the server refuses to start.
 */
const KNOWN_DEFAULTS = [
  'change-me-in-production',
  'your-super-secret-jwt-secret-min-32-chars',
  'supersecretkey123',
  'supersecret',
];

/**
 * Validate that the JWT_SECRET is not a known default and meets minimum length.
 * Exported for direct testing without module-reload gymnastics.
 */
export function validateJwtSecret(secret: string): void {
  if (KNOWN_DEFAULTS.includes(secret)) {
    throw new Error('JWT_SECRET is a known default — generate a new one with: openssl rand -base64 32');
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a secure random string (min 32 chars)');
  }
}

const jwtSecret = process.env.JWT_SECRET!;
validateJwtSecret(jwtSecret);

export const env = {
  port: Number(process.env.PORT),
  musicDir: process.env.MUSIC_DIR,
  dbPath: process.env.DB_PATH,
  coversDir: process.env.COVERS_DIR,
  jwtSecret: process.env.JWT_SECRET,
  role: role as 'source' | 'player', // Fix M4: use validated role
  sourceUrl: process.env.SOURCE_URL || undefined,
  ffplayPath: process.env.FFPLAY_PATH || 'ffplay',
};