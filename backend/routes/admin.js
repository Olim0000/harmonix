const express = require('express');
const router = express.Router();
const db = require('../db').openDb();
const bcrypt = require('bcryptjs');
const { exec } = require('child_process');
const path = require('path');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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

  const projectRoot = path.resolve(__dirname, '..', '..');
  const child = exec('node enrich-music.js', { cwd: projectRoot });

  child.stdout.on('data', (data) => res.write(data));
  child.stderr.on('data', (data) => res.write(data));

  child.on('close', (code) => {
    res.write(`\n--- enrich-music.js exited with code ${code} ---\n`);
    res.end();
  });
});

module.exports = router;
