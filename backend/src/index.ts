import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { env } from './env.js';
import { runMigrations } from './db.js';
import { logger } from './logger.js';
import { corsMiddleware } from './cors.js';
import { authMiddleware } from './auth.js';
import { registerFfplayGuard } from './player/ffplayGuard.js';
import authRoutes, { meHandler } from './routes/auth.js';
import libraryRoutes from './routes/library.js';
import searchRoutes from './routes/search.js';
import streamRoutes from './routes/stream.js';
import coversRoutes from './routes/covers.js';
import scanRoutes from './routes/scan.js';
import playerRoutes from './routes/player.js';
import sourceInfoRoutes from './routes/sourceInfo.js';
import likesRoutes from './routes/likes.js';
import playlistsRoutes from './routes/playlists.js';
import serversRoutes from './routes/servers.js';

// Run database migrations (creates tables, seeds admin user)
runMigrations();

// Register SIGINT/SIGTERM handler for ffplay cleanup
registerFfplayGuard();

const app = new Hono();
const role = env.role;
const isSource = role === 'source';

// Global CORS
app.use('*', corsMiddleware());

// Log role on startup
logger.info({ role, isSource }, 'Harmonix server starting');

// Auth routes (no auth required for register/login)
app.route('/api/auth', authRoutes);

// GET /api/me requires auth
app.get('/api/me', authMiddleware, meHandler);

// Library routes require auth (source only)
if (isSource) {
  app.use('/api/artists', authMiddleware);
  app.use('/api/albums', authMiddleware);
  app.use('/api/tracks', authMiddleware);
  app.route('/api', libraryRoutes);
} else {
  // Player-only: return 404 for library routes
  app.all('/api/artists*', (c) => c.json({ error: 'Not found' }, 404));
  app.all('/api/albums*', (c) => c.json({ error: 'Not found' }, 404));
  app.all('/api/tracks*', (c) => c.json({ error: 'Not found' }, 404));
}

// Search (source only)
if (isSource) {
  app.route('/api', searchRoutes);
} else {
  app.all('/api/search*', (c) => c.json({ error: 'Not found' }, 404));
}

// Stream (no auth — player-server needs to fetch without auth for local playback)
app.route('/api/stream', streamRoutes);

// Covers (no auth — <img> tags in frontend need direct access)
app.route('/api/covers', coversRoutes);

// Scan routes (source only — admin)
if (isSource) {
  app.route('/api/admin', scanRoutes);
} else {
  app.all('/api/admin/scan*', (c) => c.json({ error: 'Not found' }, 404));
}

// Likes, Playlists, Servers (source only — per-user data stored in DB)
// Each router has its own auth middleware scoped to its mount path,
// preventing middleware leak to sibling routes (like /api/health).
if (isSource) {
  app.route('/api/likes', likesRoutes);
  app.route('/api/playlists', playlistsRoutes);
  app.route('/api/servers', serversRoutes);
} else {
  app.all('/api/likes*', (c) => c.json({ error: 'Not found' }, 404));
  app.all('/api/playlists*', (c) => c.json({ error: 'Not found' }, 404));
  app.all('/api/servers*', (c) => c.json({ error: 'Not found' }, 404));
}

// Player routes (all roles)
app.route('/api/player', playerRoutes);

// Source info (all roles)
app.route('/api/source', sourceInfoRoutes);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', role }));

const port = env.port;

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  logger.info(`Server started on :${port} role=${role}`);
});
