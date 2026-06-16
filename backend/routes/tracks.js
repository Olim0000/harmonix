const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db').openDb();

const audioContentTypes = {
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.opus': 'audio/ogg',
};

router.get('/', (req, res) => {
  const sql = `
    SELECT
      tracks.*,
      artists.name AS artist
    FROM tracks
    LEFT JOIN artists ON artists.id = tracks.artist_id
    ORDER BY artists.name, tracks.album, tracks.title
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json(rows.map((track) => ({
      ...track,
      cover: track.cover_url ? `${baseUrl}/api/tracks/${track.id}/cover` : null,
      stream_url: `${baseUrl}/api/tracks/${track.id}/stream`,
    })));
  });
});

router.get('/:id/cover', (req, res) => {
  db.get("SELECT cover_url FROM tracks WHERE id = ?", [req.params.id], (err, track) => {
    if (err || !track || !track.cover_url) return res.status(404).json({ error: 'Cover not found' });

    const coversDir = path.resolve(__dirname, '..', 'frontend', 'public', 'covers');
    const filePath = track.cover_url.startsWith('/covers/')
      ? path.join(coversDir, path.basename(track.cover_url))
      : path.resolve(track.cover_url);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Cover not found' });

    res.sendFile(filePath);
  });
});

router.get('/:id/stream', (req, res) => {
  db.get("SELECT * FROM tracks WHERE id = ?", [req.params.id], (err, track) => {
    if (err || !track) return res.status(404).json({ error: 'Track not found' });

    const filePath = path.resolve(track.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    const contentType = audioContentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

    if (range) {
      const [start, end] = range.replace(/bytes=/, '').split('-').map(Number);
      const chunkEnd = end || Math.min(start + 1000000, stat.size - 1);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${chunkEnd}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkEnd - start + 1,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end: chunkEnd }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

module.exports = router;
