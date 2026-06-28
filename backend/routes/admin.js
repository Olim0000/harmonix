const express = require('express');
const router = express.Router();
const db = require('../db').openDb();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const enricher = require('../enricher');
const { seedMusicLibrary } = require('../db');

router.use(authenticateToken, requireAdmin);

router.get('/users', (req, res) => {
  db.all("SELECT id, username, is_admin, created_at FROM users ORDER BY username", (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

router.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }
  db.run("DELETE FROM users WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  });
});

router.post('/users/:id/reset-password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 3) return res.status(400).json({ message: 'Password must be at least 3 characters' });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.params.id], function(err) {
      if (err) return res.status(500).json({ message: err.message });
      if (this.changes === 0) return res.status(404).json({ message: 'User not found' });
      res.json({ message: 'Password updated' });
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/users/:id/set-admin', (req, res) => {
  const { is_admin } = req.body;
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ message: 'Cannot change your own admin status' });
  }
  db.run("UPDATE users SET is_admin = ? WHERE id = ?", [is_admin ? 1 : 0, req.params.id], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: is_admin ? 'User is now an admin' : 'Admin privileges removed' });
  });
});

router.post('/update-db', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('Scanning music folder...\n');
  seedMusicLibrary(db, (err) => {
    if (err) {
      res.write(`Error: ${err.message}\n`);
      return res.end();
    }
    res.write('Database updated successfully.\n');
    res.end();
  });
});

// ── Enrichment ────────────────────────────────────────────────────

router.post('/enrich', async (req, res) => {
  // Check if a job is already running
  const latest = await enricher.getLatestJob();
  if (latest && (latest.status === 'running')) {
    return res.status(409).json({ message: 'Enrichment already running', jobId: latest.id });
  }
  const mode = req.body.mode === 'full' ? 'full' : 'partial';
  try {
    const jobId = await enricher.enrich(mode);
    res.json({ message: 'Enrichment started', mode, jobId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/enrich/status', async (req, res) => {
  const jobId = req.query.jobId;
  const job = jobId ? await enricher.getJob(Number(jobId)) : await enricher.getLatestJob();
  if (!job) return res.json({ running: false });

  const enriched = job.enriched_items ? JSON.parse(job.enriched_items) : [];
  const errors = job.errors ? JSON.parse(job.errors) : [];

  res.json({
    running: job.status === 'running',
    mode: job.mode,
    step: job.current_step || '',
    total: job.total_items,
    current: job.processed_items,
    enriched,
    errors,
    status: job.status,
    jobId: job.id,
  });
});

router.post('/enrich/cancel/:jobId', async (req, res) => {
  const job = await enricher.getJob(Number(req.params.jobId));
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (job.status !== 'running') return res.status(400).json({ message: 'Job is not running' });
  await enricher.cancelJob(job.id);
  res.json({ message: 'Enrichment cancelled' });
});

router.post('/enrich/resume/:jobId', async (req, res) => {
  const jobId = await enricher.resumeJob(Number(req.params.jobId));
  if (!jobId) return res.status(400).json({ message: 'Job cannot be resumed' });
  res.json({ message: 'Enrichment resumed', jobId });
});

module.exports = router;
