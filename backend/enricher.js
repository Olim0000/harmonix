const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db').openDb;

const coversDir = require('./db').coversDir;
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ponytail: 3 retries with exponential backoff, skip non-retryable HTTP errors
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 429) { await delay(2000 * (i + 1)); continue; }
      return null;
    } catch {
      if (i < retries - 1) await delay(500 * Math.pow(2, i));
    }
  }
  return null;
}

// ── DB helpers ─────────────────────────────────────────────────────

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db().run(sql, params, function (err) {
      if (err) reject(err); else resolve(this);
    });
  });
}

function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db().all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db().get(sql, params, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

// ── Covers dir ────────────────────────────────────────────────────

function ensureCoversDir() {
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
}

async function downloadImage(url, filename) {
  ensureCoversDir();
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const name = `${filename}${ext}`;
  const filePath = path.join(coversDir, name);
  if (fs.existsSync(filePath)) return `covers/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return `covers/${name}`;
}

// ─── API calls ────────────────────────────────────────────────────

// ponytail: using Wikipedia REST API — free, no key
async function fetchArtistData(name) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  const data = await fetchWithRetry(url);
  if (!data) return null;
  return {
    bio: data.extract ? data.extract.split('\n')[0].slice(0, 1000) : null,
    imageUrl: data.thumbnail?.source || null,
  };
}

// ponytail: using Deezer public API — free, no key
async function fetchAlbumCoverUrl(artist, album) {
  const q = encodeURIComponent(`${artist} ${album}`);
  const data = await fetchWithRetry(`https://api.deezer.com/search/album?q=${q}&limit=1`);
  if (!data?.data?.length) return null;
  return data.data[0].cover_medium || null;
}

// ── Job tracking ──────────────────────────────────────────────────

const PROGRESS_INTERVAL = 5; // update DB every N items

async function createJob(mode) {
  const result = await dbRun(
    'INSERT INTO enrichment_jobs (mode, status) VALUES (?, ?)',
    [mode, 'running']
  );
  return result.lastID;
}

async function updateJobProgress(jobId, data) {
  const sets = ['updated_at = datetime(\'now\')'];
  const params = [];
  if (data.total_items !== undefined) { sets.push('total_items = ?'); params.push(data.total_items); }
  if (data.processed_items !== undefined) { sets.push('processed_items = ?'); params.push(data.processed_items); }
  if (data.current_step !== undefined) { sets.push('current_step = ?'); params.push(data.current_step); }
  if (data.enriched_items !== undefined) { sets.push('enriched_items = ?'); params.push(data.enriched_items); }
  if (data.errors !== undefined) { sets.push('errors = ?'); params.push(data.errors); }
  if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status); }
  params.push(jobId);
  await dbRun(`UPDATE enrichment_jobs SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function isCancelled(jobId) {
  const job = await dbGet('SELECT status FROM enrichment_jobs WHERE id = ?', [jobId]);
  return job?.status === 'cancelled';
}

async function getJobErrors(jobId) {
  const job = await dbGet('SELECT errors FROM enrichment_jobs WHERE id = ?', [jobId]);
  return job?.errors ? JSON.parse(job.errors) : [];
}

async function addJobError(jobId, msg) {
  const errs = await getJobErrors(jobId);
  errs.push(msg);
  await updateJobProgress(jobId, { errors: JSON.stringify(errs) });
}

async function addJobEnriched(jobId, item) {
  const job = await dbGet('SELECT enriched_items FROM enrichment_jobs WHERE id = ?', [jobId]);
  const enriched = job?.enriched_items ? JSON.parse(job.enriched_items) : [];
  enriched.push(item);
  await updateJobProgress(jobId, { enriched_items: JSON.stringify(enriched) });
}

// ── Enrichment phases ─────────────────────────────────────────────

async function enrichArtists(jobId, mode) {
  const where = mode === 'full' ? '' : 'WHERE (bio IS NULL OR image_url IS NULL)';
  const artists = await dbAll(`SELECT id, name FROM artists ${where}`);
  await updateJobProgress(jobId, { total_items: artists.length, processed_items: 0, current_step: '' });

  for (let i = 0; i < artists.length; i++) {
    if (await isCancelled(jobId)) return;
    const artist = artists[i];
    const step = `artists:${artist.name}`;
    await updateJobProgress(jobId, { processed_items: i + 1, current_step: step });

    try {
      const data = await fetchArtistData(artist.name);
      if (data) {
        const imagePath = data.imageUrl ? await downloadImage(data.imageUrl, `artist_${artist.id}`) : null;
        await dbRun('UPDATE artists SET bio = ?, image_url = ? WHERE id = ?', [data.bio, imagePath, artist.id]);
        await addJobEnriched(jobId, `artist:${artist.name}`);
      }
    } catch (e) {
      await addJobError(jobId, `Artist "${artist.name}": ${e.message}`);
    }
    await delay(500);
  }
}

async function enrichAlbums(jobId, mode) {
  // Only fetch unique artist+album combos where all tracks lack a cover
  const albums = await dbAll(
    mode === 'full'
      ? `SELECT DISTINCT a.id AS artist_id, a.name AS artist_name, t.album FROM tracks t JOIN artists a ON a.id = t.artist_id WHERE t.album IS NOT NULL`
      : `SELECT DISTINCT a.id AS artist_id, a.name AS artist_name, t.album FROM tracks t JOIN artists a ON a.id = t.artist_id WHERE t.album IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tracks t2 WHERE t2.artist_id = t.artist_id AND t2.album = t.album AND t2.cover_url IS NOT NULL AND t2.cover_url != '')`
  );

  const currentTotal = (await dbGet('SELECT total_items FROM enrichment_jobs WHERE id = ?', [jobId]))?.total_items || 0;
  await updateJobProgress(jobId, { total_items: currentTotal + albums.length });

  for (let i = 0; i < albums.length; i++) {
    if (await isCancelled(jobId)) return;
    const alb = albums[i];
    const step = `albums:${alb.artist_name} - ${alb.album}`;
    await updateJobProgress(jobId, { processed_items: (await dbGet('SELECT processed_items FROM enrichment_jobs WHERE id = ?', [jobId]))?.processed_items + 1, current_step: step });

    try {
      const coverUrl = await fetchAlbumCoverUrl(alb.artist_name, alb.album);
      if (coverUrl) {
        const hash = crypto.createHash('md5').update(alb.album).digest('hex').slice(0, 12);
        const localPath = await downloadImage(coverUrl, `album_${alb.artist_id}_${hash}`);
        await dbRun('UPDATE tracks SET cover_url = ? WHERE artist_id = ? AND album = ?', [localPath, alb.artist_id, alb.album]);
        await addJobEnriched(jobId, `album:${alb.artist_name} - ${alb.album}`);
      }
    } catch (e) {
      await addJobError(jobId, `Album "${alb.artist_name} - ${alb.album}": ${e.message}`);
    }
    await delay(200);
  }
}

// ── Public API ────────────────────────────────────────────────────

async function enrich(mode) {
  const jobId = await createJob(mode);

  // ponytail: start async so caller can return the jobId immediately
  process.nextTick(async () => {
    try {
      await enrichArtists(jobId, mode);
      if (await isCancelled(jobId)) {
        await updateJobProgress(jobId, { status: 'cancelled' });
        return;
      }
      await enrichAlbums(jobId, mode);
      if (await isCancelled(jobId)) {
        await updateJobProgress(jobId, { status: 'cancelled' });
        return;
      }

      const errs = await getJobErrors(jobId);
      const finalStatus = errs.length > 0 ? 'completed_with_errors' : 'completed';
      await updateJobProgress(jobId, { status: finalStatus, current_step: '' });
    } catch (e) {
      await addJobError(jobId, `Fatal: ${e.message}`);
      await updateJobProgress(jobId, { status: 'failed', current_step: '' });
    }
  });

  return jobId;
}

async function getLatestJob() {
  const job = await dbGet('SELECT * FROM enrichment_jobs ORDER BY id DESC LIMIT 1');
  return job || null;
}

async function getJob(jobId) {
  return dbGet('SELECT * FROM enrichment_jobs WHERE id = ?', [jobId]);
}

async function cancelJob(jobId) {
  await updateJobProgress(jobId, { status: 'cancelled' });
}

async function resumeJob(jobId) {
  const job = await dbGet('SELECT * FROM enrichment_jobs WHERE id = ?', [jobId]);
  if (!job || (job.status !== 'cancelled' && job.status !== 'failed')) return null;
  await updateJobProgress(jobId, { status: 'running' });
  const mode = job.mode;

  process.nextTick(async () => {
    try {
      // Re-process from scratch on resume (simplest approach)
      await enrichArtists(jobId, mode);
      if (await isCancelled(jobId)) return;
      await enrichAlbums(jobId, mode);
      if (await isCancelled(jobId)) return;
      const errs = await getJobErrors(jobId);
      await updateJobProgress(jobId, { status: errs.length > 0 ? 'completed_with_errors' : 'completed', current_step: '' });
    } catch (e) {
      await addJobError(jobId, `Fatal: ${e.message}`);
      await updateJobProgress(jobId, { status: 'failed', current_step: '' });
    }
  });

  return jobId;
}

module.exports = { enrich, getLatestJob, getJob, cancelJob, resumeJob };
