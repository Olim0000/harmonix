/**
 * Home page (T25) — per DESIGN.md §4.3.
 * Sections: Recently Played (stub with localStorage), New Releases (most recent albums).
 * Empty state before scan: CTA to Admin → Scan.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAlbums } from '../api/library';
import { AlbumCard } from '../components/ui/AlbumCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { LibraryIcon } from '../components/icons';
import type { Album } from '../types/api';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [newReleases, setNewReleases] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAlbums()
      .then((albums) => {
        if (cancelled) return;
        // Most recent first (already sorted by year DESC from API)
        setNewReleases(albums.slice(0, 12));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load albums');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load library"
        description={error}
      />
    );
  }

  // Empty state: no albums scanned yet
  if (newReleases.length === 0) {
    return (
      <EmptyState
        icon={<LibraryIcon size={48} />}
        title="Your music library is empty"
        description="Scan your library from Admin → Scan to get started."
      />
    );
  }

  return (
    <div>
      {/* New Releases */}
      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="text-lg" style={{ marginBottom: 'var(--space-4)' }}>
          New Releases
        </h2>
        <div
          className="album-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-4)',
          }}
        >
          {newReleases.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      </section>
    </div>
  );
};

Home.displayName = 'Home';
