const express = require('express');
const router = express.Router();
const player = require('../player');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/play', (req, res) => {
  const { streamUrl, title, artist, coverUrl } = req.body;
  if (!streamUrl) return res.status(400).json({ error: 'streamUrl is required' });
  player.play(streamUrl, title, artist, coverUrl);
  res.json(player.getStatus());
});

router.post('/pause', (req, res) => {
  player.pause();
  res.json(player.getStatus());
});

router.post('/resume', (req, res) => {
  player.resume();
  res.json(player.getStatus());
});

router.post('/stop', (req, res) => {
  player.stop();
  res.json(player.getStatus());
});

router.post('/seek', (req, res) => {
  const { position } = req.body;
  if (position === undefined || position === null) return res.status(400).json({ error: 'position is required' });
  player.seek(Number(position));
  res.json(player.getStatus());
});

router.post('/volume', (req, res) => {
  const { level } = req.body;
  if (level === undefined || level === null) return res.status(400).json({ error: 'level is required' });
  player.setVolume(Number(level));
  res.json(player.getStatus());
});

router.get('/status', (req, res) => {
  res.json(player.getStatus());
});

module.exports = router;
