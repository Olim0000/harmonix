#!/usr/bin/env node

/**
 * Harmonix — Music Metadata Enrichment Script
 * 
 * Run once (or anytime you add new music):
 *   node enrich-music.js
 * 
 * What it does:
 *   1. Scans your music/ folder for FLAC (and mp3/ogg/m4a) files
 *   2. Reads embedded tags (Vorbis comments for FLAC, ID3 for mp3)
 *   3. Falls back to filename parsing if tags are missing
 *   4. Inserts/updates tracks, artists in your SQLite DB
 *   5. Fetches artist bios from Wikipedia
 *   6. Fetches album covers from MusicBrainz + Cover Art Archive
 *   7. Saves covers to frontend/public/covers/
 * 
 * Install deps first:
 *   npm install music-metadata better-sqlite3 node-fetch@2
 */

const fs = require("fs");
const path = require("path");
const mm = require("music-metadata");
const Database = require("better-sqlite3");
const fetch = require("node-fetch");
const https = require("https");

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const MUSIC_DIR = path.resolve(__dirname, "music");
const DB_PATH = path.resolve(__dirname, "backend/harmonix.db");
const COVERS_DIR = path.resolve(__dirname, "frontend/public/covers");
const SUPPORTED = [".flac", ".mp3", ".ogg", ".m4a", ".opus"];
const DELAY_MS = 1200; // be polite to free APIs

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitize(str) {
  return str ? str.trim().replace(/\0/g, "") : "";
}

/**
 * Parse artist + title from a filename when tags are missing.
 * Handles common patterns:
 *   "Artist - Title.flac"
 *   "01 - Artist - Title.flac"
 *   "01. Title.flac"  (no artist in name)
 *   "Title.flac"
 */
function parseFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  const cleaned = base.replace(/^\d+[\s.\-_]+/, "").trim();
  const parts = cleaned.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return { artist: sanitize(parts[0]), title: sanitize(parts.slice(1).join(" - ")) };
  }
  return { artist: null, title: sanitize(cleaned) };
}

/**
 * Download a file from url to destPath.
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// ─── WIKIPEDIA BIO ───────────────────────────────────────────────────────────

async function fetchWikipediaBio(artistName) {
  try {
    const encoded = encodeURIComponent(artistName);
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Harmonix/1.0 (self-hosted music app)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === "disambiguation" || !data.extract) return null;
    // Only use it if Wikipedia thinks it's a musician/band
    const extract = data.extract;
    const musicKeywords = ["band", "musician", "singer", "rapper", "artist", "group", "duo", "trio", "composer", "producer", "vocalist", "guitarist", "drummer"];
    const lowerExtract = extract.toLowerCase();
    const isMusic = musicKeywords.some((kw) => lowerExtract.includes(kw));
    if (!isMusic) {
      // Still return it but flag it — might be a false match
      return extract + "\n\n[Note: Wikipedia match may not be the musician — verify manually]";
    }
    return extract;
  } catch {
    return null;
  }
}

// ─── COVER ART ───────────────────────────────────────────────────────────────

/**
 * Search MusicBrainz for a release, return the first release ID found.
 */
async function searchMusicBrainz(artistName, album) {
  try {
    const query = album
      ? `release:"${album}" AND artist:"${artistName}"`
      : `artist:"${artistName}"`;
    const url = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(query)}&limit=3&fmt=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Harmonix/1.0 (self-hosted music app; contact@example.com)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.releases || data.releases.length === 0) return null;
    return data.releases[0].id;
  } catch {
    return null;
  }
}

/**
 * Fetch cover from Cover Art Archive using a MusicBrainz release ID.
 * Downloads to COVERS_DIR and returns the relative web path.
 */
async function fetchCover(releaseId, slug) {
  try {
    const url = `https://coverartarchive.org/release/${releaseId}/front-500`;
    const destPath = path.join(COVERS_DIR, `${slug}.jpg`);
    await downloadFile(url, destPath);
    return `/covers/${slug}.jpg`;
  } catch {
    return null;
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  // Setup
  if (!fs.existsSync(MUSIC_DIR)) {
    console.error(`❌  music/ folder not found at ${MUSIC_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(COVERS_DIR, { recursive: true });

  const db = new Database(DB_PATH);

  // Ensure schema exists (safe to run even if tables already exist)
  db.exec(`
    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      bio TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist_id INTEGER REFERENCES artists(id),
      album TEXT,
      duration_seconds INTEGER,
      file_path TEXT NOT NULL UNIQUE,
      cover_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const insertArtist = db.prepare(`
    INSERT INTO artists (name) VALUES (?)
    ON CONFLICT(name) DO NOTHING
  `);
  const getArtist = db.prepare(`SELECT * FROM artists WHERE name = ?`);
  const updateArtistBio = db.prepare(`UPDATE artists SET bio = ? WHERE id = ?`);
  const updateArtistImage = db.prepare(`UPDATE artists SET image_url = ? WHERE id = ?`);
  const insertTrack = db.prepare(`
    INSERT INTO tracks (title, artist_id, album, duration_seconds, file_path, cover_url)
    VALUES (@title, @artist_id, @album, @duration_seconds, @file_path, @cover_url)
    ON CONFLICT(file_path) DO UPDATE SET
      title = excluded.title,
      artist_id = excluded.artist_id,
      album = excluded.album,
      duration_seconds = excluded.duration_seconds,
      cover_url = excluded.cover_url
  `);

  // Scan music folder recursively
  function scanDir(dir) {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(scanDir(fullPath));
      } else if (SUPPORTED.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const files = scanDir(MUSIC_DIR);
  console.log(`\n🎵  Found ${files.length} audio files\n`);

  // ── STEP 1: Read tags and insert tracks + artists ──────────────────────────

  console.log("── Step 1: Reading tags and updating database ──\n");

  for (const filePath of files) {
    const relativePath = path.relative(__dirname, filePath);
    let title, artistName, album, duration;

    try {
      const meta = await mm.parseFile(filePath, { duration: true });
      const tags = meta.common;

      title = sanitize(tags.title);
      artistName = sanitize(tags.artist || tags.albumartist);
      album = sanitize(tags.album);
      duration = Math.round(meta.format.duration || 0);

      // Embedded cover — save it if present and no file cover yet
      if (tags.picture && tags.picture.length > 0) {
        const pic = tags.picture[0];
        const slug = Buffer.from(relativePath).toString("base64url").slice(0, 40);
        const ext = pic.format.includes("png") ? "png" : "jpg";
        const coverPath = path.join(COVERS_DIR, `${slug}.${ext}`);
        if (!fs.existsSync(coverPath)) {
          fs.writeFileSync(coverPath, pic.data);
        }
      }
    } catch {
      // Tag reading failed — fall back to filename
    }

    // Fallback to filename parsing
    if (!title || !artistName) {
      const parsed = parseFilename(filePath);
      title = title || parsed.title || path.basename(filePath, path.extname(filePath));
      artistName = artistName || parsed.artist || "Unknown Artist";
    }

    // Insert artist
    insertArtist.run(artistName);
    const artist = getArtist.get(artistName);

    // Insert/update track
    insertTrack.run({
      title,
      artist_id: artist.id,
      album: album || null,
      duration_seconds: duration || null,
      file_path: relativePath,
      cover_url: null,
    });

    console.log(`  ✓  ${artistName} — ${title}`);
  }

  // ── STEP 2: Enrich artists with Wikipedia bios ────────────────────────────

  console.log("\n── Step 2: Fetching Wikipedia bios ──\n");

  const artistsNoBio = db.prepare(`SELECT * FROM artists WHERE bio IS NULL`).all();

  for (const artist of artistsNoBio) {
    process.stdout.write(`  Wikipedia: ${artist.name} ... `);
    const bio = await fetchWikipediaBio(artist.name);
    if (bio) {
      updateArtistBio.run(bio, artist.id);
      console.log("✓");
    } else {
      console.log("not found");
    }
    await sleep(DELAY_MS);
  }

  // ── STEP 3: Fetch missing covers from Cover Art Archive ───────────────────

  console.log("\n── Step 3: Fetching missing covers ──\n");

  // Get tracks missing covers, grouped by artist + album
  const tracksMissingCover = db.prepare(`
    SELECT t.*, a.name as artist_name
    FROM tracks t
    JOIN artists a ON t.artist_id = a.id
    WHERE t.cover_url IS NULL
  `).all();

  // Deduplicate by artist+album so we don't hammer the API
  const seen = new Set();
  const toEnrich = [];
  for (const track of tracksMissingCover) {
    const key = `${track.artist_name}||${track.album || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      toEnrich.push(track);
    }
  }

  const coverMap = {}; // key → cover_url

  for (const track of toEnrich) {
    const key = `${track.artist_name}||${track.album || ""}`;
    const label = track.album
      ? `${track.artist_name} — ${track.album}`
      : track.artist_name;
    process.stdout.write(`  Cover Art Archive: ${label} ... `);

    const releaseId = await searchMusicBrainz(track.artist_name, track.album);
    await sleep(DELAY_MS);

    if (!releaseId) {
      console.log("not found");
      coverMap[key] = null;
      continue;
    }

    const slug = Buffer.from(key).toString("base64url").slice(0, 40);
    const coverUrl = await fetchCover(releaseId, slug);
    await sleep(DELAY_MS);

    if (coverUrl) {
      coverMap[key] = coverUrl;
      console.log(`✓  ${coverUrl}`);
    } else {
      coverMap[key] = null;
      console.log("download failed");
    }
  }

  // Apply covers to all matching tracks
  const updateTrackCover = db.prepare(`UPDATE tracks SET cover_url = ? WHERE id = ?`);
  for (const track of tracksMissingCover) {
    const key = `${track.artist_name}||${track.album || ""}`;
    const coverUrl = coverMap[key];
    if (coverUrl) {
      updateTrackCover.run(coverUrl, track.id);
    }
  }

  // Also set artist image from their first available track cover
  const updateArtistImageFromTrack = db.prepare(`
    UPDATE artists SET image_url = (
      SELECT cover_url FROM tracks
      WHERE artist_id = artists.id AND cover_url IS NOT NULL
      LIMIT 1
    )
    WHERE image_url IS NULL
  `);
  updateArtistImageFromTrack.run();

  // ── DONE ──────────────────────────────────────────────────────────────────

  const stats = {
    tracks: db.prepare(`SELECT COUNT(*) as c FROM tracks`).get().c,
    artists: db.prepare(`SELECT COUNT(*) as c FROM artists`).get().c,
    withBio: db.prepare(`SELECT COUNT(*) as c FROM artists WHERE bio IS NOT NULL`).get().c,
    withCover: db.prepare(`SELECT COUNT(*) as c FROM tracks WHERE cover_url IS NOT NULL`).get().c,
  };

  console.log(`
──────────────────────────────
✅  Enrichment complete

  Tracks in DB   : ${stats.tracks}
  Artists in DB  : ${stats.artists}
  Artists with bio   : ${stats.withBio} / ${stats.artists}
  Tracks with cover  : ${stats.withCover} / ${stats.tracks}
──────────────────────────────

Next steps:
  • Drop more FLACs in music/ and re-run to add them
  • Check frontend/public/covers/ for downloaded artwork
  • Artists without bios: add manually in DB or check spelling
`);

  db.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
