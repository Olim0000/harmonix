const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db').openDb;

// ponytail: no retry logic, no queue, single attempt — re-run partial on failure
const coversDir = path.resolve(__dirname, '..', 'frontend', 'public', 'covers');
const delay = (ms) => new Promise(r => setTimeout(r, ms));

function ensureCoversDir() {
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
}

// ponytail: using Wikipedia REST API — free, no key
async function fetchArtistData(name) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    bio: data.extract ? data.extract.split('\n')[0].slice(0, 1000) : null,
    imageUrl: data.thumbnail?.source || null,
  };
}

// ponytail: using Deezer public API — free, no key
async function fetchAlbumCoverUrl(artist, album) {
  const q = encodeURIComponent(`${artist} ${album}`);
  const res = await fetch(`https://api.deezer.com/search/album?q=${q}&limit=1`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.data?.length) return null;
  return data.data[0].cover_medium || null;
}

async function downloadImage(url, filename) {
  ensureCoversDir();
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const filePath = path.join(coversDir, filename + ext);
  if (fs.existsSync(filePath)) return `${filename}${ext}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return `${filename}${ext}`;
}

function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db().all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db().run(sql, params, function (err) {
      if (err) reject(err); else resolve(this);
    });
  });
}

// ponytail: yields to event loop between each item — server stays responsive
async function enrichArtists(mode, job) {
  const where = mode === 'full' ? '' : 'WHERE (bio IS NULL OR image_url IS NULL)';
  const artists = await dbAll(`SELECT id, name FROM artists ${where}`);
  job.total += artists.length;
  for (const artist of artists) {
    if (job.cancelled) break;
    job.step = `artists:${artist.name}`;
    job.current++;
    try {
      const data = await fetchArtistData(artist.name);
      if (data) {
        const imagePath = data.imageUrl ? await downloadImage(data.imageUrl, `artist_${artist.id}`) : null;
        await dbRun('UPDATE artists SET bio = ?, image_url = ? WHERE id = ?', [data.bio, imagePath, artist.id]);
        job.enriched.push(`artist:${artist.name}`);
      }
    } catch (e) {
      job.errors.push(`Artist "${artist.name}": ${e.message}`);
    }
    await delay(500);
  }
}

async function enrichAlbums(mode, job) {
  const albums = await dbAll(
    mode === 'full'
      ? `SELECT DISTINCT a.id AS artist_id, a.name AS artist_name, t.album FROM tracks t JOIN artists a ON a.id = t.artist_id WHERE t.album IS NOT NULL`
      : `SELECT DISTINCT a.id AS artist_id, a.name AS artist_name, t.album FROM tracks t JOIN artists a ON a.id = t.artist_id WHERE t.album IS NOT NULL AND (t.cover_url IS NULL OR t.cover_url = '')`
  );
  job.total += albums.length;
  for (const alb of albums) {
    if (job.cancelled) break;
    job.step = `albums:${alb.artist_name} - ${alb.album}`;
    job.current++;
    try {
      const coverUrl = await fetchAlbumCoverUrl(alb.artist_name, alb.album);
      if (coverUrl) {
        // ponytail: hash the album name for a short unique filename
        const hash = crypto.createHash('md5').update(alb.album).digest('hex').slice(0, 12);
        const localPath = await downloadImage(coverUrl, `album_${alb.artist_id}_${hash}`);
        await dbRun('UPDATE tracks SET cover_url = ? WHERE artist_id = ? AND album = ?', [localPath, alb.artist_id, alb.album]);
        job.enriched.push(`album:${alb.artist_name} - ${alb.album}`);
      }
    } catch (e) {
      job.errors.push(`Album "${alb.artist_name} - ${alb.album}": ${e.message}`);
    }
    await delay(200);
  }
}

async function enrich(mode) {
  const job = { running: true, cancelled: false, mode, step: '', total: 0, current: 0, enriched: [], errors: [] };
  // use nextTick to start asynchronously so the caller can return immediately
  process.nextTick(async () => {
    try {
      await enrichArtists(mode, job);
      await enrichAlbums(mode, job);
    } catch (e) {
      job.errors.push(`Fatal: ${e.message}`);
    }
    job.running = false;
  });
  return job;
}

module.exports = { enrich };
