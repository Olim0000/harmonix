const express = require('express');
const router = express.Router();
const db = require('../db').openDb();

router.get('/', (req, res) => {
  const sql = `
    SELECT artists.*, COUNT(tracks.id) AS track_count
    FROM artists
    LEFT JOIN tracks ON tracks.artist_id = artists.id
    GROUP BY artists.id
    ORDER BY artists.name
  `;
  db.all(sql, [], (err, rows) => {
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

router.get('/:id/tracks', (req, res) => {
  const sql = `
    SELECT
      tracks.*,
      artists.name AS artist
    FROM tracks
    LEFT JOIN artists ON artists.id = tracks.artist_id
    WHERE tracks.artist_id = ?
    ORDER BY tracks.album, tracks.title
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

module.exports = router;
