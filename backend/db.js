const { spawnSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const projectRoot = path.resolve(__dirname, '..');
const dbPath = process.env.DB_PATH
  ? (process.env.DB_PATH.startsWith('~/') ? path.join(os.homedir(), process.env.DB_PATH.slice(2)) : path.resolve(__dirname, process.env.DB_PATH))
  : path.join(__dirname, 'harmonix.db');
const musicDir = process.env.MUSIC_DIR
  ? (process.env.MUSIC_DIR.startsWith('~/') ? path.join(os.homedir(), process.env.MUSIC_DIR.slice(2)) : path.resolve(projectRoot, process.env.MUSIC_DIR))
  : path.join(projectRoot, 'music');
console.log('Music directory:', musicDir);
const supportedAudioExtensions = new Set(['.flac', '.mp3', '.ogg', '.m4a', '.opus']);
const supportedCoverExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
let db;

function openDb() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      }
    });
  }

  return db;
}

const createTableSql = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 3001,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    bio TEXT,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist_id INTEGER,
    album TEXT,
    duration_seconds INTEGER,
    file_path TEXT,
    cover_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES artists(id)
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_type, item_id)
  );
`;

function findAudioFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findAudioFiles(fullPath));
    } else if (supportedAudioExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function parseAlbumFolder(folderName) {
  const match = folderName.match(/^(.*?)\s+-\s+(.*?)(?:\s+\((\d{4})\))?$/);
  if (!match) return { artist: 'Unknown Artist', album: folderName };

  return {
    artist: match[1].trim() || 'Unknown Artist',
    album: match[3] ? `${match[2].trim()} (${match[3]})` : match[2].trim() || folderName,
  };
}

function parseTrackTitle(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/^\d+\s*[-._]\s*/, '')
    .trim();
}

function findCoverForTrack(filePath) {
  const dir = path.dirname(filePath);
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const cover = entries.find((entry) => {
    if (!entry.isFile()) return false;
    const ext = path.extname(entry.name).toLowerCase();
    const name = path.basename(entry.name, ext).toLowerCase();
    return supportedCoverExtensions.has(ext) && ['cover', 'folder', 'front'].includes(name);
  });

  return cover ? path.join(dir, cover.name) : null;
}

function getAudioDuration(filePath) {
  try {
    const result = spawnSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
    ], { timeout: 5000, encoding: 'utf-8' });
    if (result.status !== 0 || !result.stdout) return null;
    return Math.round(parseFloat(result.stdout.trim()));
  } catch {
    return null;
  }
}

function migrateSchema(database, callback) {
  database.all('PRAGMA table_info(tracks)', (err, columns) => {
    if (err) return callback(err);

    const hasAlbum = columns.some((column) => column.name === 'album');
    if (!hasAlbum) {
      database.run('ALTER TABLE tracks ADD COLUMN album TEXT');
    }

    database.all('PRAGMA table_info(users)', (err, userCols) => {
      if (err) return callback(err);

      const hasAdmin = userCols.some((col) => col.name === 'is_admin');
      if (hasAdmin) return afterUsers(database, callback);

      database.run("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0", (alterErr) => {
        if (alterErr) return callback(alterErr);
        afterUsers(database, callback);
      });
    });
  });
}

function afterUsers(database, callback) {
  database.all('PRAGMA table_info(likes)', (err, likeCols) => {
    if (err) return callback(err);
    const hasTrackId = likeCols.some(c => c.name === 'track_id');
    if (!hasTrackId) return callback();
    database.run('DROP TABLE IF EXISTS likes', (dropErr) => {
      if (dropErr) return callback(dropErr);
      database.run(`CREATE TABLE likes (
        user_id TEXT NOT NULL, item_type TEXT NOT NULL,
        item_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, item_type, item_id)
      )`, callback);
    });
  });
}

function removeMissingTracks(database, callback) {
  database.all('SELECT id, file_path FROM tracks WHERE file_path IS NOT NULL', (err, tracks) => {
    if (err) return callback(err);

    const missingTrackIds = tracks
      .filter((track) => !fs.existsSync(path.resolve(track.file_path)))
      .map((track) => track.id);

    if (missingTrackIds.length === 0) return callback();

    const placeholders = missingTrackIds.map(() => '?').join(',');
    database.run(`DELETE FROM tracks WHERE id IN (${placeholders})`, missingTrackIds, callback);
  });
}

function getOrCreateArtist(database, name, callback) {
  database.get('SELECT id FROM artists WHERE lower(name) = lower(?)', [name], (err, artist) => {
    if (err) return callback(err);
    if (artist) return callback(null, artist.id);

    database.run('INSERT INTO artists (name) VALUES (?)', [name], function(insertErr) {
      if (insertErr) return callback(insertErr);
      callback(null, this.lastID);
    });
  });
}

function upsertTrack(database, track, callback) {
  database.get('SELECT id, duration_seconds FROM tracks WHERE file_path = ?', [track.file_path], (err, existingTrack) => {
    if (err) return callback(err);

    if (existingTrack) {
      if (track.duration_seconds && !existingTrack.duration_seconds) {
        database.run('UPDATE tracks SET duration_seconds = ? WHERE id = ?', [track.duration_seconds, existingTrack.id], callback);
      } else {
        callback();
      }
      return;
    }

    database.run(
      'INSERT INTO tracks (title, artist_id, album, duration_seconds, file_path, cover_url) VALUES (?, ?, ?, ?, ?, ?)',
      [track.title, track.artist_id, track.album, track.duration_seconds ?? null, track.file_path, track.cover_url],
      callback
    );
  });
}

function seedMusicLibrary(database, callback) {
  if (!fs.existsSync(musicDir)) {
    console.error(`Music directory not found: "${musicDir}". Set MUSIC_DIR in backend/.env or place audio files in music/.`);
    return callback(null);
  }

  const files = findAudioFiles(musicDir);

  if (files.length === 0) {
    console.warn(`No audio files found in "${musicDir}". Supported formats: flac, mp3, ogg, m4a, opus. Set MUSIC_DIR in backend/.env to a different path.`);
    return callback(null);
  }

  let index = 0;

  function next(err) {
    if (err) return callback(err);
    if (index >= files.length) {
      database.run('DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM tracks WHERE artist_id IS NOT NULL)', callback);
      return;
    }

    const filePath = files[index];
    index += 1;

    const folder = path.basename(path.dirname(filePath));
    const albumInfo = parseAlbumFolder(folder);
    const coverPath = findCoverForTrack(filePath);
    const durationSeconds = getAudioDuration(filePath);

    getOrCreateArtist(database, albumInfo.artist, (artistErr, artistId) => {
      if (artistErr) return callback(artistErr);

      upsertTrack(database, {
        title: parseTrackTitle(filePath),
        artist_id: artistId,
        album: albumInfo.album,
        file_path: filePath,
        cover_url: coverPath,
        duration_seconds: durationSeconds,
      }, next);
    });
  }

  removeMissingTracks(database, (removeErr) => {
    if (removeErr) return callback(removeErr);
    next();
  });
}

function seedAdminUser(database, callback) {
  database.get("SELECT id FROM users WHERE is_admin = 1", (err, row) => {
    if (err) return callback(err);
    if (row) return callback();

    const bcrypt = require('bcryptjs');
    bcrypt.hash('admin123', 10, (hashErr, hash) => {
      if (hashErr) return callback(hashErr);
      database.run("INSERT OR IGNORE INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)", ['admin', hash], callback);
    });
  });
}

function initializeDb(callback) {
  const database = openDb();

  database.serialize(() => {
    database.exec(createTableSql, (createErr) => {
      if (createErr) return callback(createErr);

      migrateSchema(database, (migrationErr) => {
        if (migrationErr) return callback(migrationErr);

        seedAdminUser(database, (seedErr) => {
          if (seedErr) return callback(seedErr);

          seedMusicLibrary(database, callback);
        });
      });
    });
  });
}

module.exports = { 
  openDb,
  initializeDb,
  seedMusicLibrary,
};
