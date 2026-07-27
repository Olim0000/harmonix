import { Hono } from 'hono';
import { createTestApp } from './test/setup.js';
import { authMiddleware } from './src/auth.js';
import authRoutesModule from './src/routes/auth.js';
const { default: authRoutes, meHandler } = authRoutesModule;

const app = createTestApp();
app.route('/api/auth', authRoutes);
app.get('/api/me', authMiddleware, meHandler);

// Print all routes
console.log('Routes:');
app.routes.forEach((r) => {
  console.log(`  ${r.method} ${r.path}`);
});

// Test refresh
const res = await app.request('/api/auth/refresh', {
  method: 'POST',
  headers: { Authorization: 'Bearer test' },
});
console.log('\nRefresh status:', res.status);
