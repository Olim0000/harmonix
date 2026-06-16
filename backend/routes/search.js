const express = require('express');
const router = express.Router();
const db = require('../db').openDb();

router.get('/', (req, res) => {
  const { q } = req.query;
  
  if (!q) return res.status(400).json({ message: 'Query parameter "q" is required' });

  db.all("SELECT * FROM tracks WHERE title LIKE ?", [`%${q}%`], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });

});

module.exports = router;
