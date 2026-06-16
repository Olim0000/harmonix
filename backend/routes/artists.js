const express = require('express');
const router = express.Router();
const db = require('../db').openDb();

router.get('/', (req, res) => {
  db.all("SELECT * FROM artists", [], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get("SELECT * FROM artists WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!row) return res.sendStatus(404);
    res.json(row);
  });
});

module.exports = router;
