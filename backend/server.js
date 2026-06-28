const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const { initializeDb } = require('./db');

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

// Define routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tracks', require('./routes/tracks'));
app.use('/api/artists', require('./routes/artists'));
app.use('/api/search', require('./routes/search'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/albums', require('./routes/albums'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/player', require('./routes/player'));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/likes', require('./routes/likes'));

// Serve covers directory so artist images load from backend too
app.use('/covers', express.static(path.resolve(__dirname, '..', 'frontend', 'public', 'covers')));

// Start the server
initializeDb((err) => {
  if (err) {
    console.error('Error initializing database:', err.message);
    process.exit(1);
  }

  // Auto-seed on first run (empty library)
  const db = require('./db').openDb();
  db.get('SELECT COUNT(*) AS cnt FROM tracks', (countErr, row) => {
    if (countErr) {
      console.error('Error checking library:', countErr.message);
    } else if (row.cnt === 0) {
      console.log('Empty library — running initial scan...');
      require('./db').seedMusicLibrary(db, (seedErr) => {
        if (seedErr) console.error('Initial scan error:', seedErr.message);
        app.listen(port, () => console.log(`Server running on port ${port}`));
      });
    } else {
      app.listen(port, () => console.log(`Server running on port ${port}`));
    }
  });
});
