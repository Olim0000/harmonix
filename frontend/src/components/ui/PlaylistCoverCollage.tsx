/**
 * PlaylistCoverCollage — 2×2 grid of album covers for a playlist.
 * Fetches first 4 track album_ids, fills empty slots with music note placeholder.
 * Used on playlist cards (H7) and playlist detail header (H8).
 */
import React, { useEffect, useState } from 'react';
import { fetchPlaylistDetail } from '../../api/playlists';
import { coverUrl } from '../../api/client';

interface PlaylistCoverCollageProps {
  playlistId: number;
  /** Size in px for each cell (default 24 for cards, 96 for detail header) */
  cellSize?: number;
  /** Number of tracks to fetch covers for (default 4) */
  count?: number;
}

const MusicNoteIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18V5l8-2v13" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="14" cy="16" r="2" />
  </svg>
);

export const PlaylistCoverCollage: React.FC<PlaylistCoverCollageProps> = ({
  playlistId,
  cellSize = 24,
  count = 4,
}) => {
  const [albumIds, setAlbumIds] = useState<number[]>([]);

  useEffect(() => {
    fetchPlaylistDetail(playlistId)
      .then((data) => {
        const ids = data.tracks
          .slice(0, count)
          .map((t) => t.album_id)
          .filter((id) => id > 0);
        setAlbumIds(ids);
      })
      .catch(() => {
        /* playlist may not exist yet or has no tracks */
      });
  }, [playlistId, count]);

  const totalSize = cellSize * 2;
  const hasCovers = albumIds.length > 0;

  return (
    <div
      style={{
        width: totalSize,
        height: totalSize,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 1,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-accent)',
        flexShrink: 0,
      }}
    >
      {[0, 1, 2, 3].map((i) => {
        const albumId = albumIds[i];
        if (albumId) {
          return (
            <div
              key={i}
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                overflow: 'hidden',
              }}
            >
              <img
                src={coverUrl('album', albumId)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
              />
            </div>
          );
        }
        return (
          <div
            key={i}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              opacity: 0.4,
            }}
          >
            <MusicNoteIcon size={cellSize * 0.5} />
          </div>
        );
      })}
    </div>
  );
};

PlaylistCoverCollage.displayName = 'PlaylistCoverCollage';
