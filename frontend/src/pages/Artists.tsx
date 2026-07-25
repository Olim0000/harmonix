/**
 * Artists page (T27) — per DESIGN.md §4.5.
 * Grid of ArtistCard, search filter.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { fetchArtists } from '../api/library';
import { ArtistCard } from '../components/ui/ArtistCard';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useDebounce } from '../hooks/useDebounce';
import type { Artist } from '../types/api';

export const Artists: React.FC = () => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    fetchArtists()
      .then(setArtists)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return artists;
    const q = debouncedSearch.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, debouncedSearch]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load artists" description={error} />;
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
        }}
      >
        <h1 className="text-xl">Artists</h1>
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Input
            variant="search"
            placeholder="Filter artists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={artists.length === 0 ? 'No artists found' : 'No matching artists'}
          description={
            artists.length === 0
              ? 'Scan your library to add artists.'
              : 'Try a different search term.'
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 'var(--space-4)',
          }}
          className="artist-card-grid"
        >
          {filtered.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  );
};

Artists.displayName = 'Artists';
