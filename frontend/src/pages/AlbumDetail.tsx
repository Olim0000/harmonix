/**
 * AlbumDetail page (T29) — per DESIGN.md §4.7.
 * Header: cover, title, artist, year, track count, total duration.
 * Action bar: Play, Shuffle, heart-like.
 * Tracklist: number, title, duration, heart action.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAlbum, toggleLike } from '../api/library';
import { coverUrl } from '../api/client';
import { Button } from '../components/ui/Button';
import { ListRow } from '../components/ui/ListRow';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { HeartIcon, HeartFilledIcon } from '../components/icons';
import { useUIStore } from '../stores/ui';
import { formatTotalDuration } from '../utils/format';
import type { AlbumDetailResponse } from '../types/api';

export const AlbumDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const addToast = useUIStore((s) => s.addToast);

  const [data, setData] = useState<AlbumDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchAlbum(Number(id))
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const totalDuration = useMemo(() => {
    if (!data) return null;
    return data.tracks.reduce(
      (sum, t) => sum + (t.duration_seconds || 0),
      0
    );
  }, [data]);

  const handleLike = async () => {
    if (!id) return;
    try {
      const res = await toggleLike('album', Number(id));
      setLiked(res.liked);
    } catch {
      addToast('Failed to toggle like', 'error');
    }
  };

  const handlePlay = () => {
    addToast('Play — TODO: P1c-2 player hookup', 'info');
  };

  const handleShuffle = () => {
    addToast('Shuffle — TODO: P1c-2 player hookup', 'info');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !data) {
    return <EmptyState title="Album not found" description={error || 'Could not load album'} />;
  }

  const { album, tracks } = data;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-tertiary)',
            flexShrink: 0,
          }}
        >
          <img
            src={coverUrl('album', album.id)}
            alt={album.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="text-2xl" style={{ marginBottom: 4 }}>
            {album.title}
          </h1>
          <Link
            to={`/artists/${album.artist_id}`}
            className="text-base"
            style={{ color: 'var(--bg-accent)', marginBottom: 8, display: 'inline-block' }}
          >
            {album.artist_name}
          </Link>

          <div className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            {album.year && <span>{album.year}</span>}
            {album.track_count != null && (
              <span> &middot; {album.track_count} track{album.track_count !== 1 ? 's' : ''}</span>
            )}
            {totalDuration != null && totalDuration > 0 && (
              <span> &middot; {formatTotalDuration(totalDuration)}</span>
            )}
          </div>

          {/* Action bar */}
          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)' }}>
            <Button variant="primary" onClick={handlePlay}>
              Play
            </Button>
            <Button variant="secondary" onClick={handleShuffle}>
              Shuffle
            </Button>
            <Button variant="ghost" onClick={handleLike} aria-label="Like">
              {liked ? <HeartFilledIcon size={18} /> : <HeartIcon size={18} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <section>
        {tracks.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)', padding: 'var(--space-4)' }}>
            This album has no tracks.
          </p>
        ) : (
          <div>
            {/* Table header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px 8px',
                borderBottom: '1px solid var(--border-primary)',
                color: 'var(--text-tertiary)',
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span style={{ width: 36, flexShrink: 0 }}>#</span>
              <span style={{ flex: 1 }}>Title</span>
              <span style={{ width: 48, textAlign: 'right', flexShrink: 0 }}>Duration</span>
              <span style={{ width: 56, flexShrink: 0 }} />
            </div>

            {tracks.map((track, i) => (
              <ListRow
                key={track.id}
                index={track.track_number != null ? track.track_number : i + 1}
                title={track.title}
                subtitle={track.artist_name}
                duration={track.duration_seconds}
                trackId={track.id}
                onPlay={() => addToast(`Play "${track.title}" — TODO: P1c-2`, 'info')}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

AlbumDetail.displayName = 'AlbumDetail';
