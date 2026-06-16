const express = require('express');
const router = express.Router();
const db = require('../db').openDb();
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  const sql = `
    SELECT
      p.id,
      p.user_id,
      p.name,
      p.created_at,
      COUNT(pt.track_id) AS track_count,
      COALESCE(SUM(t.duration_seconds), 0) AS total_duration
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
    LEFT JOIN tracks t ON t.id = pt.track_id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;
  db.all(sql, [req.user.username], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  db.get("SELECT * FROM playlists WHERE id = ? AND user_id = ?", [req.params.id, req.user.username], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!row) return res.sendStatus(404);
    res.json(row);
  });
});

router.get('/:id/tracks', authenticateToken, (req, res) => {
  const sql = `
    SELECT
      pt.position,
      tracks.*,
      artists.name AS artist
    FROM playlist_tracks pt
    JOIN tracks ON tracks.id = pt.track_id
    LEFT JOIN artists ON artists.id = tracks.artist_id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position, tracks.title
  `;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json(rows.map((track) => ({
      ...track,
      cover: track.cover_url ? `${baseUrl}/api/tracks/${track.id}/cover` : null,
      stream_url: `${baseUrl}/api/tracks/${track.id}/stream`,
    })));
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

  db.get("SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?", [req.params.id, trackId], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    if (row) return res.status(409).json({ message: 'Track is already in the playlist' });

    db.run("INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)", [req.params.id, trackId, 0], function(insertErr) {
      if (insertErr) return res.status(500).json({ message: insertErr.message });
      res.json({ message: 'Track added to playlist' });
    });
  });
});

router.delete('/:id/tracks/:trackId', authenticateToken, (req, res) => {
  db.run("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?", [req.params.id, req.params.trackId], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Track removed from playlist' });
  });  
});

module.exports = router;
