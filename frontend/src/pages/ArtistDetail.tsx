/**
 * ArtistDetail page (T28) — per DESIGN.md §4.6.
 * Hero section with image + bio placeholder, action bar, albums grid.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchArtist, toggleLike } from '../api/library';
import { coverUrl } from '../api/client';
import { AlbumCard } from '../components/ui/AlbumCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { HeartIcon, HeartFilledIcon } from '../components/icons';
import { useUIStore } from '../stores/ui';
import type { ArtistDetailResponse } from '../types/api';

export const ArtistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const addToast = useUIStore((s) => s.addToast);

  const [data, setData] = useState<ArtistDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchArtist(Number(id))
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleLike = async () => {
    if (!id) return;
    try {
      const res = await toggleLike('artist', Number(id));
      setLiked(res.liked);
    } catch {
      addToast('Failed to toggle like', 'error');
    }
  };

  const handleShuffleAll = () => {
    addToast('Shuffle All — TODO: P1c-2 player hookup', 'info');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !data) {
    return <EmptyState title="Artist not found" description={error || 'Could not load artist'} />;
  }

  const { artist, albums } = data;

  return (
    <div>
      {/* Hero section */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-8)',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-tertiary)',
            flexShrink: 0,
          }}
        >
          <img
            src={coverUrl('artist', artist.id)}
            alt={artist.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="text-2xl" style={{ marginBottom: 8 }}>
            {artist.name}
          </h1>

          <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            {albums.length} album{albums.length !== 1 ? 's' : ''}
          </p>

          <p className="text-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 16 }}>
            No bio available — enrichment Phase 2
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" onClick={handleShuffleAll}>
              Shuffle All
            </Button>
            <Button variant="ghost" onClick={handleLike} aria-label="Like">
              {liked ? <HeartFilledIcon size={18} /> : <HeartIcon size={18} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Albums */}
      <section>
        <h2 className="text-lg" style={{ marginBottom: 'var(--space-4)' }}>
          Albums
        </h2>
        {albums.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No albums for this artist.
          </p>
        ) : (
          <div
            className="album-card-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 'var(--space-4)',
            }}
          >
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

ArtistDetail.displayName = 'ArtistDetail';
