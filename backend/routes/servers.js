const express = require('express');
const router = express.Router();
const db = require('../db').openDb();
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', (req, res) => {
  db.all(
    'SELECT id, name, host, port, created_at FROM servers WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    }
  );
});

router.post('/', (req, res) => {
  const { name, host, port } = req.body;
  if (!name || !host) return res.status(400).json({ error: 'name and host are required' });

  db.run(
    'INSERT INTO servers (user_id, name, host, port) VALUES (?, ?, ?, ?)',
    [req.user.id, name, host, port || 3001],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      res.status(201).json({ id: this.lastID, name, host, port: port || 3001 });
    }
  );
});

router.delete('/:id', (req, res) => {
  db.run(
    'DELETE FROM servers WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Server not found' });
      res.json({ message: 'Server deleted' });
    }
  );
});

module.exports = router;
