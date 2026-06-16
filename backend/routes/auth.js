const express = require('express');
const router = express.Router();
const db = require('../db').openDb();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.serialize(() => {
    db.run("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)", [username, hashedPassword], function(err) {
      if (err) return res.status(500).json({ message: 'Username already taken.' });

      const token = jwt.sign({ id: this.lastID, username, is_admin: false }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, is_admin: false });
    });    
  });

});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], async function(err, row) {
    if (!row || !await bcrypt.compare(password, row.password_hash)) return res.sendStatus(401);

    const is_admin = !!row.is_admin;
    const token = jwt.sign({ id: row.id, username, is_admin }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, is_admin });
  });
});

module.exports = router;
