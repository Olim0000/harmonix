const express = require('express');
const router = express.Router();
const db = require('../db').openDb();
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, (req, res) => {
  const itemType = req.query.itemType || 'track';
  const full = req.query.full === 'true';

  db.all("SELECT item_id, created_at FROM likes WHERE user_id = ? AND item_type = ?", [req.user.username, itemType], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!full) return res.json(rows);

    const ids = rows.map(r => r.item_id);
    if (ids.length === 0) return res.json([]);
    const placeholders = ids.map(() => '?').join(',');
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    if (itemType === 'track') {
      db.all(`SELECT tracks.*, artists.name AS artist FROM tracks LEFT JOIN artists ON artists.id = tracks.artist_id WHERE tracks.id IN (${placeholders})`, ids, (err2, tracks) => {
        if (err2) return res.status(500).json({ message: err2.message });
        res.json(tracks.map((track) => ({
          ...track,
          cover: track.cover_url ? `${baseUrl}/api/tracks/${track.id}/cover` : null,
          stream_url: `${baseUrl}/api/tracks/${track.id}/stream`,
        })));
      });
    } else if (itemType === 'artist') {
      db.all(`SELECT * FROM artists WHERE id IN (${placeholders})`, ids, (err2, artists) => {
        if (err2) return res.status(500).json({ message: err2.message });
        res.json(artists);
      });
    } else if (itemType === 'album') {
      // ponytail: item_id format = "artistId:albumName"
      const conditions = ids.map(id => {
        const sep = id.indexOf(':');
        return `(tracks.artist_id = ${parseInt(id.substring(0, sep))} AND tracks.album = ${JSON.stringify(id.substring(sep + 1))})`;
      }).join(' OR ');
      db.all(`SELECT tracks.album, tracks.artist_id, artists.name AS artist, COUNT(*) AS track_count,
        (SELECT id FROM tracks t2 WHERE t2.artist_id = tracks.artist_id AND t2.album = tracks.album AND t2.cover_url IS NOT NULL LIMIT 1) AS cover_track_id
        FROM tracks LEFT JOIN artists ON artists.id = tracks.artist_id
        WHERE ${conditions}
        GROUP BY tracks.artist_id, tracks.album`, (err2, albums) => {
        if (err2) return res.status(500).json({ message: err2.message });
        res.json(albums.map(a => ({
          ...a,
          cover: a.cover_track_id ? `${baseUrl}/api/tracks/${a.cover_track_id}/cover` : null,
        })));
      });
    }
  });
});

router.post('/', authenticateToken, (req, res) => {
  const { itemType, itemId } = req.body;
  if (!itemType || !itemId) return res.status(400).json({ message: 'itemType and itemId are required' });
  db.run("INSERT OR IGNORE INTO likes (user_id, item_type, item_id) VALUES (?, ?, ?)", [req.user.username, itemType, itemId], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    res.status(201).json({ message: 'Liked', item_type: itemType, item_id: itemId });
  });
});

router.delete('/:itemType/:itemId', authenticateToken, (req, res) => {
  db.run("DELETE FROM likes WHERE user_id = ? AND item_type = ? AND item_id = ?", [req.user.username, req.params.itemType, req.params.itemId], function(err) {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Unliked' });
  });
});

module.exports = router;
