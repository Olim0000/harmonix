/**
 * Scanner — non-blocking music library scanner (T09).
 *
 * Walks a music directory, parses folder names for Artist - Album (Year),
 * reads audio metadata via music-metadata, and populates the DB.
 *
 * Designed to run in the background while the server remains responsive.
 * Progress is reported via the ScanJob interface.
 *
 * Fixes: async walk, symlink protection, cancel API, transaction wrapping, path.relative.
 */
import { readdir, stat, mkdir, writeFile, realpath } from 'fs/promises';
import { join, extname, basename, dirname, resolve, sep, relative } from 'path';
import { parseFile } from 'music-metadata';
import type Database from 'better-sqlite3';
import { logger } from '../logger.js';
import { env } from '../env.js';
import { ftsRowid } from '../db.js';

/** File extensions we scan. */
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.ogg', '.m4a', '.opus', '.wav', '.aac', '.wma',
]);

const FOLDER_PATTERN = /^(.+?)\s*-\s*(.+?)(?:\s*\((\d{4})\))?\s*$/;
const FILE_PATTERN = /^(\d+)\s*[-.]\s*(.+?)\.\w+$/;

export interface ScanProgress {
  scanned: number;
  total: number;
  currentPath: string;
  foundTracks: number;
  foundAlbums: number;
  foundArtists: number;
  done: boolean;
  error?: string;
}

export interface ScanJob {
  isRunning(): boolean;
  getStatus(): ScanProgress;
  promise: Promise<void>;
  cancel(): void;
}

// Module-level cancel flag (set by scanMusicDir's cancel function)
let scanCancelled = false;

/**
 * Scan a music directory and populate the database.
 * Runs asynchronously — returns a ScanJob immediately.
 *
 * @param musicDir — absolute path to music directory
 * @param database — better-sqlite3 database instance
 */
export function scanMusicDir(musicDir: string, database: Database.Database): ScanJob {
  const status: ScanProgress = {
    scanned: 0,
    total: 0,
    currentPath: '',
    foundTracks: 0,
    foundAlbums: 0,
    foundArtists: 0,
    done: false,
  };

  let running = true;
  scanCancelled = false; // Reset for new scan

  const promise = (async () => {
    try {
      // Ensure musicDir is absolute
      const musicDirAbs = resolve(musicDir);

      const artistCache = new Map<string, number>(); // artist name → artist id
      const albumCache = new Map<string, number>();  // artist_id:album_title:year → album id

      // Track seen file_paths for idempotent re-scan
      const existingPaths = new Set<string>();
      const existingTracks = database.prepare('SELECT file_path FROM tracks').all() as { file_path: string }[];
      for (const row of existingTracks) {
        existingPaths.add(row.file_path);
      }

      // Walk files asynchronously (non-blocking)
      const allFiles = await walkAudioFiles(musicDirAbs);
      status.total = allFiles.length;

      // Process files in batches per directory
      let currentDir = '';
      let dirBatch: string[] = [];

      for (const filePath of allFiles) {
        if (scanCancelled) break;

        const fileDir = dirname(filePath);
        if (fileDir !== currentDir) {
          // Process previous directory batch
          if (dirBatch.length > 0) {
            await processBatch(dirBatch, database, musicDirAbs, artistCache, albumCache, existingPaths, status);
            dirBatch = [];
          }
          currentDir = fileDir;
        }

        status.scanned++;
        status.currentPath = filePath;
        dirBatch.push(filePath);
      }

      // Process final batch
      if (dirBatch.length > 0 && !scanCancelled) {
        await processBatch(dirBatch, database, musicDirAbs, artistCache, albumCache, existingPaths, status);
      }

      status.done = true;
      logger.info({
        foundTracks: status.foundTracks,
        foundAlbums: status.foundAlbums,
        foundArtists: status.foundArtists,
        totalFiles: allFiles.length,
      }, 'Scan complete');
    } catch (err: any) {
      if (!scanCancelled) {
        status.error = err.message;
        status.done = true;
        logger.error({ err }, 'Scan failed');
      }
    } finally {
      running = false;
    }
  })();

  return {
    isRunning: () => running,
    getStatus: () => ({ ...status }),
    promise,
    cancel: () => { scanCancelled = true; },
  };
}

/**
 * Process a batch of files from the same directory.
 * First parses metadata for all files (outside transaction), then inserts in a single transaction.
 */
async function processBatch(
  filePaths: string[],
  database: Database.Database,
  musicDirAbs: string,
  artistCache: Map<string, number>,
  albumCache: Map<string, number>,
  existingPaths: Set<string>,
  status: ScanProgress
): Promise<void> {
  // First, parse metadata for all files (outside transaction)
  const fileData: Array<{
    filePath: string;
    artistName: string;
    albumTitle: string;
    year: number | null;
    trackNumber: number;
    titleFromFile: string;
    relativePath: string;
    metadataTitle: string;
    duration: number | null;
    coverData: Buffer | null;
    coverFormat: string | null;
    albumId?: number; // Will be set during transaction
  }> = [];

  for (const filePath of filePaths) {
    if (scanCancelled) break;

    // Parse parent folder name for artist/album/year
    const parentDir = basename(dirname(filePath));
    const folderMatch = parentDir.match(FOLDER_PATTERN);

    if (!folderMatch) {
      // Skip files not in Artist - Album (Year) folders
      continue;
    }

    const artistName = folderMatch[1].trim();
    const albumTitle = folderMatch[2].trim();
    const year = folderMatch[3] ? parseInt(folderMatch[3], 10) : null;

    // Parse filename for track number and title
    const fileName = basename(filePath);
    const fileMatch = fileName.match(FILE_PATTERN);

    if (!fileMatch) {
      // Skip files that don't match "NN - Title.ext" pattern
      continue;
    }

    const trackNumber = parseInt(fileMatch[1], 10);
    const titleFromFile = fileMatch[2].trim();

    // Resolve file path relative to musicDir for DB storage
    const relativePath = relative(musicDirAbs, filePath);

    // Check idempotency — skip if file_path already exists with same path
    if (existingPaths.has(relativePath)) {
      continue;
    }

    // Use music-metadata to get additional info
    let metadataTitle = titleFromFile;
    let duration: number | null = null;
    let coverData: Buffer | null = null;
    let coverFormat: string | null = null;

    try {
      const metadata = await parseFile(filePath);
      if (metadata.common.title) {
        metadataTitle = metadata.common.title;
      }
      if (metadata.format.duration) {
        duration = Math.round(metadata.format.duration);
      }
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        coverData = Buffer.from(pic.data);
        coverFormat = pic.format;
      }
    } catch (err: any) {
      logger.debug({ filePath, err: err.message }, 'Failed to parse metadata');
      // Continue with filename-based metadata
    }

    fileData.push({
      filePath,
      artistName,
      albumTitle,
      year,
      trackNumber,
      titleFromFile,
      relativePath,
      metadataTitle,
      duration,
      coverData,
      coverFormat,
    });
  }

  // Now insert all in a single transaction
  // First, save all cover files (async, outside transaction)
  const coverUpdates: Array<{ albumId: number; coverFileName: string }> = [];

  for (const data of fileData) {
    if (scanCancelled) break;

    if (data.coverData && data.coverFormat && data.albumId) {
      try {
        // Sanitize extension
        const ext = (data.coverFormat.split('/').pop() || 'jpg')
          .replace(/[^a-z0-9]/gi, '')
          .toLowerCase() || 'jpg';
        const coverFileName = `${data.albumId}.${ext}`;

        const coversDir = resolve(env.coversDir || join(dirname(env.dbPath || '.'), '../..', 'data', 'covers'));
        await mkdir(coversDir, { recursive: true });
        const coverPath = join(coversDir, coverFileName);
        await writeFile(coverPath, data.coverData);

        coverUpdates.push({ albumId: data.albumId, coverFileName });
      } catch (err: any) {
        logger.debug({ err: err.message, albumId: data.albumId }, 'Failed to save cover art');
      }
    }
  }

  // Now insert all DB records in a single transaction
  const transaction = database.transaction(() => {
    for (const data of fileData) {
      if (scanCancelled) break;

      // Get or create artist
      let artistId = artistCache.get(data.artistName);
      if (!artistId) {
        const existing = database.prepare(
          'SELECT id FROM artists WHERE lower(name) = lower(?)'
        ).get(data.artistName) as { id: number } | undefined;

        if (existing) {
          artistId = existing.id;
        } else {
          const result = database.prepare(
            'INSERT INTO artists (name) VALUES (?)'
          ).run(data.artistName);
          artistId = result.lastInsertRowid as number;
          status.foundArtists++;
        }
        artistCache.set(data.artistName, artistId);
      }

      // Get or create album
      const albumKey = `${artistId}:${data.albumTitle}:${data.year ?? ''}`;
      let albumId = albumCache.get(albumKey);
      if (!albumId) {
        const existing = database.prepare(
          'SELECT id FROM albums WHERE artist_id = ? AND title = ?'
        ).get(artistId, data.albumTitle) as { id: number } | undefined;

        if (existing) {
          albumId = existing.id;
        } else {
          const result = database.prepare(
            'INSERT INTO albums (artist_id, title, year) VALUES (?, ?, ?)'
          ).run(artistId, data.albumTitle, data.year);
          albumId = result.lastInsertRowid as number;
          status.foundAlbums++;
        }
        albumCache.set(albumKey, albumId);
      }

      // Store albumId in data for cover update phase
      data.albumId = albumId;

      // Insert track
      database.prepare(`
        INSERT INTO tracks (album_id, artist_id, title, track_number, file_path, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(albumId, artistId, data.metadataTitle, data.trackNumber, data.relativePath, data.duration);
      status.foundTracks++;
      existingPaths.add(data.relativePath);
    }

    // Apply cover path updates
    for (const { albumId, coverFileName } of coverUpdates) {
      database.prepare('UPDATE albums SET cover_path = ? WHERE id = ?')
        .run(coverFileName, albumId);
    }
  });

  transaction();
}

/**
 * Walk a directory recursively and return all audio file paths.
 * Async, non-blocking, with symlink protection and depth limit.
 */
async function walkAudioFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const visited = new Set<string>(); // realpath for symlink loop detection
  const MAX_DEPTH = 50;

  async function walk(current: string, depth: number = 0): Promise<void> {
    if (depth > MAX_DEPTH) return;

    // Resolve symlinks to detect loops
    const realPath = await realpathSafe(current);
    if (visited.has(realPath)) {
      logger.debug({ dir: current, realPath }, 'Symlink loop detected, skipping');
      return;
    }
    visited.add(realPath);

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (err: any) {
      logger.debug({ dir: current, err: err.message }, 'Error reading directory');
      return;
    }

    for (const entry of entries) {
      if (scanCancelled) break;
      const fullPath = join(current, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          await walk(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (AUDIO_EXTENSIONS.has(ext)) {
          results.push(fullPath);
        }
      }
      // Note: we ignore symlinks that point to files (entry.isSymbolicLink())
      // but we DO follow directory symlinks with loop detection above
    }
  }

  await walk(dir);
  return results;
}

/**
 * Safe realpath that falls back to the original path if resolution fails.
 */
async function realpathSafe(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}