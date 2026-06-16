const express = require('express');
const router = express.Router();
const db = require('../db').openDb();

router.get('/:artistId/:albumName/tracks', (req, res) => {
  const { artistId, albumName } = req.params;
  const decodedAlbum = decodeURIComponent(albumName);

  const sql = `
    SELECT
      tracks.*,
      artists.name AS artist
    FROM tracks
    LEFT JOIN artists ON artists.id = tracks.artist_id
    WHERE tracks.artist_id = ? AND tracks.album = ?
    ORDER BY tracks.title
  `;

  db.all(sql, [artistId, decodedAlbum], (err, rows) => {
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
