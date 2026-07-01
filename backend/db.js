const { spawnSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const mm = require('music-metadata');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const projectRoot = path.resolve(__dirname, '..');
const dbPath = process.env.DB_PATH
  ? (process.env.DB_PATH.startsWith('~/') ? path.join(os.homedir(), process.env.DB_PATH.slice(2)) : path.resolve(__dirname, process.env.DB_PATH))
  : path.join(__dirname, 'harmonix.db');
const musicDir = process.env.MUSIC_DIR
  ? (process.env.MUSIC_DIR.startsWith('~/') ? path.join(os.homedir(), process.env.MUSIC_DIR.slice(2)) : path.resolve(projectRoot, process.env.MUSIC_DIR))
  : path.join(projectRoot, 'music');
const coversDir = path.resolve(projectRoot, 'frontend', 'public', 'covers');
const supportedAudioExtensions = new Set(['.flac', '.mp3', '.ogg', '.m4a', '.opus']);
const supportedCoverExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

let db;

function openDb() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) console.error('Error opening database:', err.message);
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
    file_mtime INTEGER,
    file_size INTEGER,
    genre TEXT,
    year INTEGER,
    track_number INTEGER,
    disc_number INTEGER,
    composer TEXT,
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

  CREATE TABLE IF NOT EXISTS enrichment_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    current_step TEXT,
    enriched_items TEXT,
    errors TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );
`;

function findAudioFiles(dir, callback) {
  if (!fs.existsSync(dir)) return callback([]);
  const exts = [...supportedAudioExtensions];
  const args = [dir, '-type', 'f', '(', ...exts.flatMap(e => ['-name', `*${e}`]), ')'];
  const child = require('child_process').spawn('find', args);
  const lines = [];
  let lastLog = 0;
  child.stdout.on('data', chunk => {
    for (const line of chunk.toString().split('\n').filter(Boolean)) {
      lines.push(line);
    }
    if (lines.length - lastLog >= 1000) {
      console.log(`[Scan] Found ${lines.length} files...`);
      lastLog = lines.length;
    }
  });
  child.stderr.on('data', chunk => console.error('[Scan] find stderr:', chunk.toString()));
  child.on('close', code => {
    if (code !== 0) console.warn(`[Scan] find exited with code ${code}`);
    lines.sort();
    callback(lines);
  });
  child.on('error', err => {
    console.error('[Scan] find error:', err.message);
    callback([]);
  });
}

function parseAlbumFolder(folderName) {
  let m = folderName.match(/^(.*?)\s+[-–]\s+(.*?)\s*[\(\[](\d{4})[\)\]]\s*$/);
  if (m) return { artist: m[1].trim(), album: `${m[2].trim()} (${m[3]})` };
  m = folderName.match(/^(.*?)\s+[-–]\s+(.*)$/);
  if (m) return { artist: m[1].trim(), album: m[2].trim() };
  return { artist: 'Unknown Artist', album: folderName };
}

function parseTrackTitle(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/^\d+\s*[-._]\s*/, '').trim();
}

function findCoverInDir(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const cover = entries.find(e => {
      if (!e.isFile()) return false;
      const ext = path.extname(e.name).toLowerCase();
      const name = path.basename(e.name, ext).toLowerCase();
      return supportedCoverExtensions.has(ext) && ['cover', 'folder', 'front'].includes(name);
    });
    return cover ? path.join(dir, cover.name) : null;
  } catch { return null; }
}

function getAudioDuration(filePath) {
  try {
    const result = spawnSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
    ], { timeout: 10000, encoding: 'utf-8' });
    if (result.status !== 0 || !result.stdout) return null;
    return Math.round(parseFloat(result.stdout.trim()));
  } catch { return null; }
}

function ensureCoversDir() {
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
}

// Copy a local cover file to covers/ with deterministic name, return relative path
function copyCoverToCovers(sourcePath, artistId, album) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return null;
  ensureCoversDir();
  const ext = path.extname(sourcePath).toLowerCase();
  const hash = crypto.createHash('md5').update(album || sourcePath).digest('hex').slice(0, 12);
  const destName = `album_${artistId}_${hash}${ext}`;
  const destPath = path.join(coversDir, destName);
  if (fs.existsSync(destPath)) return `covers/${destName}`;
  try {
    fs.copyFileSync(sourcePath, destPath);
    return `covers/${destName}`;
  } catch (e) {
    console.error('Failed to copy cover:', e.message);
    return null;
  }
}

// Save embedded cover art from audio tags to covers/
async function saveCoverFromBuffer(picture, filePath) {
  if (!picture || !picture.data) return null;
  ensureCoversDir();
  const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[picture.format] || '.jpg';
  const hash = crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12);
  const name = `cover_${hash}${ext}`;
  const destPath = path.join(coversDir, name);
  if (!fs.existsSync(destPath)) {
    try { fs.writeFileSync(destPath, Buffer.from(picture.data)); } catch { return null; }
  }
  return `covers/${name}`;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Read metadata from audio file; fallback to folder/filename parsing
async function scanFile(filePath) {
  try {
    const meta = await withTimeout(mm.parseFile(filePath, { duration: false }), 15000);
    const c = meta.common;
    let coverUrl = null;
    if (c.picture?.[0]) coverUrl = await saveCoverFromBuffer(c.picture[0], filePath);
    return {
      title: c.title || parseTrackTitle(filePath),
      artist: c.artist || 'Unknown Artist',
      album: c.album || path.basename(path.dirname(filePath)),
      year: c.year || null,
      genre: c.genre?.[0] || null,
      track_number: c.track?.no || null,
      disc_number: c.disk?.no || null,
      composer: c.composer?.[0] || null,
      duration: meta.format.duration ? Math.round(meta.format.duration) : null,
      cover_url: coverUrl,
    };
  } catch {
    return fallbackParse(filePath);
  }
}

function fallbackParse(filePath) {
  const folder = path.basename(path.dirname(filePath));
  const albumInfo = parseAlbumFolder(folder);
  return {
    title: parseTrackTitle(filePath),
    artist: albumInfo.artist,
    album: albumInfo.album,
    year: null,
    genre: null,
    track_number: null,
    disc_number: null,
    composer: null,
    duration: getAudioDuration(filePath),
    cover_url: null,
  };
}

// ── Schema migrations ──────────────────────────────────────────────

function migrateSchema(database, callback) {
  database.all('PRAGMA table_info(tracks)', (err, columns) => {
    if (err) return callback(err);
    const cols = columns.map(c => c.name);

    const stmts = [];
    if (!cols.includes('album')) stmts.push('ALTER TABLE tracks ADD COLUMN album TEXT');
    if (!cols.includes('file_mtime')) stmts.push('ALTER TABLE tracks ADD COLUMN file_mtime INTEGER');
    if (!cols.includes('file_size')) stmts.push('ALTER TABLE tracks ADD COLUMN file_size INTEGER');
    if (!cols.includes('genre')) stmts.push('ALTER TABLE tracks ADD COLUMN genre TEXT');
    if (!cols.includes('year')) stmts.push('ALTER TABLE tracks ADD COLUMN year INTEGER');
    if (!cols.includes('track_number')) stmts.push('ALTER TABLE tracks ADD COLUMN track_number INTEGER');
    if (!cols.includes('disc_number')) stmts.push('ALTER TABLE tracks ADD COLUMN disc_number INTEGER');
    if (!cols.includes('composer')) stmts.push('ALTER TABLE tracks ADD COLUMN composer TEXT');

    database.all('PRAGMA table_info(users)', (err, userCols) => {
      if (err) return callback(err);
      const ucols = userCols.map(c => c.name);
      if (!ucols.includes('is_admin')) stmts.push("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");

      database.all('PRAGMA table_info(likes)', (err, likeCols) => {
        if (err) return callback(err);
        const needsLikesRecreate = likeCols.map(c => c.name).includes('track_id');

        // Unique index for case-insensitive artist lookup
        stmts.push('CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_name_lower ON artists(lower(name))');

        function runNext(idx) {
          if (idx >= stmts.length) {
            if (needsLikesRecreate) {
              database.run('DROP TABLE IF EXISTS likes', dropErr => {
                if (dropErr) return callback(dropErr);
                database.run(`CREATE TABLE likes (
                  user_id TEXT NOT NULL, item_type TEXT NOT NULL,
                  item_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (user_id, item_type, item_id)
                )`, callback);
              });
            } else {
              callback();
            }
            return;
          }
          database.run(stmts[idx], err => {
            if (err) return callback(err);
            runNext(idx + 1);
          });
        }
        runNext(0);
      });
    });
  });
}

// Normalize existing cover_url entries to `covers/` relative paths
function migrateCovers(database, callback) {
  database.all("SELECT id, cover_url FROM tracks WHERE cover_url IS NOT NULL AND cover_url != ''", (err, rows) => {
    if (err) return callback(err);
    let idx = 0;

    function next() {
      if (idx >= rows.length) return callback();
      const row = rows[idx++];
      const old = row.cover_url;

      if (old.startsWith('covers/')) return setImmediate(next);

      let newUrl = null;
      if (path.isAbsolute(old) && fs.existsSync(old)) {
        // Local cover file — copy to covers dir
        ensureCoversDir();
        const ext = path.extname(old).toLowerCase();
        const hash = crypto.createHash('md5').update(old).digest('hex').slice(0, 12);
        const destName = `cover_${hash}${ext}`;
        const destPath = path.join(coversDir, destName);
        if (!fs.existsSync(destPath)) {
          try { fs.copyFileSync(old, destPath); } catch {}
        }
        newUrl = `covers/${destName}`;
      } else if (!path.isAbsolute(old)) {
        // Bare filename from old enricher — file should already be in covers dir
        newUrl = `covers/${old}`;
      }

      if (newUrl) {
        database.run('UPDATE tracks SET cover_url = ? WHERE id = ?', [newUrl, row.id], err => {
          if (err) console.error('Cover migration error:', err.message);
          next();
        });
      } else {
        database.run('UPDATE tracks SET cover_url = NULL WHERE id = ?', [row.id], next);
      }
    }
    next();
  });
}

// ── Music library seeding ──────────────────────────────────────────

function removeMissingTracks(database, callback) {
  database.all('SELECT id, file_path FROM tracks WHERE file_path IS NOT NULL', (err, tracks) => {
    if (err) return callback(err);
    const missingIds = tracks.filter(t => !fs.existsSync(path.resolve(t.file_path))).map(t => t.id);
    if (missingIds.length === 0) return callback();
    const ph = missingIds.map(() => '?').join(',');
    database.run(`DELETE FROM tracks WHERE id IN (${ph})`, missingIds, callback);
  });
}

function getOrCreateArtist(database, name, callback) {
  database.get('SELECT id FROM artists WHERE lower(name) = lower(?)', [name], (err, artist) => {
    if (err) return callback(err);
    if (artist) return callback(null, artist.id);
    database.run('INSERT OR IGNORE INTO artists (name) VALUES (?)', [name], function(insertErr) {
      if (insertErr) return callback(insertErr);
      if (this.changes > 0) return callback(null, this.lastID);
      database.get('SELECT id FROM artists WHERE lower(name) = lower(?)', [name], (err2, a2) => {
        if (err2) return callback(err2);
        callback(null, a2.id);
      });
    });
  });
}

function upsertTrack(database, track, callback) {
  database.get('SELECT id, duration_seconds, file_mtime, file_size FROM tracks WHERE file_path = ?', [track.file_path], (err, existing) => {
    if (err) return callback(err);

    if (existing) {
      if (track.file_mtime !== undefined && track.file_mtime === existing.file_mtime) {
        if (track.duration && !existing.duration_seconds) {
          database.run('UPDATE tracks SET duration_seconds = ? WHERE id = ?', [track.duration, existing.id], callback);
        } else {
          callback();
        }
        return;
      }
      database.run(
        'UPDATE tracks SET title = ?, artist_id = ?, album = ?, duration_seconds = ?, cover_url = ?, file_mtime = ?, file_size = ?, genre = ?, year = ?, track_number = ?, disc_number = ?, composer = ? WHERE id = ?',
        [track.title, track.artist_id, track.album, track.duration ?? null, track.cover_url, track.file_mtime ?? null, track.file_size ?? null, track.genre ?? null, track.year ?? null, track.track_number ?? null, track.disc_number ?? null, track.composer ?? null, existing.id],
        callback
      );
      return;
    }

    database.run(
      'INSERT INTO tracks (title, artist_id, album, duration_seconds, file_path, cover_url, file_mtime, file_size, genre, year, track_number, disc_number, composer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [track.title, track.artist_id, track.album, track.duration ?? null, track.file_path, track.cover_url, track.file_mtime ?? null, track.file_size ?? null, track.genre ?? null, track.year ?? null, track.track_number ?? null, track.disc_number ?? null, track.composer ?? null],
      callback
    );
  });
}

function seedMusicLibrary(database, callback) {
  (async () => {
    console.log('Music directory:', musicDir);
    console.log('[Scan] Walking directory tree...');
    if (!fs.existsSync(musicDir)) {
      console.error(`Music directory not found: "${musicDir}"`);
      return callback(null);
    }

    const files = await new Promise(resolve => findAudioFiles(musicDir, resolve));
    if (files.length === 0) {
      console.warn(`No audio files found in "${musicDir}"`);
      return callback(null);
    }

    // Remove tracks for files that no longer exist
    await new Promise((resolve, reject) => {
      removeMissingTracks(database, err => err ? reject(err) : resolve());
    });

    for (const filePath of files) {
      let stat;
      try { stat = fs.statSync(filePath); } catch { continue; }

      // Read metadata from tags, fallback to folder/filename parsing
      const track = await scanFile(filePath);

      // Get or create artist
      const artistId = await new Promise((resolve, reject) => {
        getOrCreateArtist(database, track.artist, (err, id) => err ? reject(err) : resolve(id));
      });

      // Copy local cover if tags didn't provide one
      let coverUrl = track.cover_url;
      if (!coverUrl) {
        const localCover = findCoverInDir(path.dirname(filePath));
        if (localCover) coverUrl = copyCoverToCovers(localCover, artistId, track.album);
      }

      // Insert or update track in DB
      await new Promise((resolve, reject) => {
        upsertTrack(database, {
          title: track.title,
          artist_id: artistId,
          album: track.album,
          file_path: filePath,
          cover_url: coverUrl,
          duration: track.duration,
          genre: track.genre,
          year: track.year,
          track_number: track.track_number,
          disc_number: track.disc_number,
          composer: track.composer,
          file_mtime: stat.mtimeMs,
          file_size: stat.size,
        }, err => err ? reject(err) : resolve());
      });
    }

    // Cleanup orphaned artists
    await new Promise((resolve, reject) => {
      database.run('DELETE FROM artists WHERE id NOT IN (SELECT DISTINCT artist_id FROM tracks WHERE artist_id IS NOT NULL)', err => err ? reject(err) : resolve());
    });

    callback(null);
  })().catch(callback);
}

// ── Admin user ──────────────────────────────────────────────────────

function seedAdminUser(database, callback) {
  database.get("SELECT id FROM users WHERE is_admin = 1", (err, row) => {
    if (err) return callback(err);
    if (row) { console.log('[DB] Admin user already exists'); return callback(); }
    const bcrypt = require('bcryptjs');
    bcrypt.hash('admin123', 10, (hashErr, hash) => {
      if (hashErr) return callback(hashErr);
      database.run("INSERT OR IGNORE INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)", ['admin', hash], callback);
    });
  });
}

// ── Initialize DB (tables + migrations only) ──────────────────────

function initializeDb(callback) {
  console.log('[DB] Initializing database...');
  const database = openDb();
  database.serialize(() => {
    database.exec(createTableSql, createErr => {
      if (createErr) return callback(createErr);
      console.log('[DB] Running schema migrations...');
      migrateSchema(database, migrationErr => {
        if (migrationErr) return callback(migrationErr);
        console.log('[DB] Running cover path migration...');
        migrateCovers(database, coverErr => {
          if (coverErr) return callback(coverErr);
          console.log('[DB] Ensuring admin user...');
          seedAdminUser(database, err => {
            if (!err) console.log('[DB] Database initialized');
            callback(err);
          });
        });
      });
    });
  });
}

module.exports = {
  openDb,
  initializeDb,
  seedMusicLibrary,
  get coversDir() { return coversDir; },
};
