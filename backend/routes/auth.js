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
    db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, hashedPassword], function(err) {
      if (err) return res.status(500).json({ message: 'Username already taken.' });

      const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    });    
  });

});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], async function(err, row) {
    if (!row || !await bcrypt.compare(password, row.password_hash)) return res.sendStatus(401);

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  });
});

module.exports = router;
