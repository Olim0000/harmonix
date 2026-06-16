const express = require('express');
const router = express.Router();
const db = require('../db').openDb();
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  db.all("SELECT * FROM playlists WHERE user_id = ?", [req.user.username], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

router.post('/', authenticateToken, (req, res) => {
  const { name } = req.body;

  db.run("INSERT INTO playlists (user_id, name) VALUES (?, ?)", [req.user.username, name], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ id: this.lastID, user_id: req.user.username, name });
  });  
});

router.delete('/:id', authenticateToken, (req, res) => {
  db.run("DELETE FROM playlists WHERE id = ? AND user_id = ?", [req.params.id, req.user.username], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Playlist deleted' });
  });  
});

router.post('/:id/tracks', authenticateToken, (req, res) => {
  const { trackId } = req.body;

  db.run("INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)", [req.params.id, trackId, 0], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Track added to playlist' });
  });
});

router.delete('/:id/tracks/:trackId', authenticateToken, (req, res) => {
  db.run("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?", [req.params.id, req.params.trackId], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Track removed from playlist' });
  });  
});

module.exports = router;
