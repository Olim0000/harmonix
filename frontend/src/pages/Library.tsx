/**
 * Library page (T26) — per DESIGN.md §4.4.
 * Grid of AlbumCard, search filter (client-side fuzzy), sort dropdown.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { fetchAlbums } from '../api/library';
import { AlbumCard } from '../components/ui/AlbumCard';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useDebounce } from '../hooks/useDebounce';
import type { Album } from '../types/api';

type SortKey = 'title' | 'artist' | 'year';

export const Library: React.FC = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('year');

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    fetchAlbums()
      .then(setAlbums)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load albums');
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = [...albums];

    // Client-side fuzzy filter on title + artist
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.artist_name && a.artist_name.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'artist':
          return (a.artist_name || '').localeCompare(b.artist_name || '');
        case 'year':
          return (b.year || 0) - (a.year || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [albums, debouncedSearch, sort]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load library" description={error} />;
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
        }}
      >
        <h1 className="text-xl">Library</h1>
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Input
            variant="search"
            placeholder="Filter albums..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={{
            height: 40,
            padding: '0 12px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 14,
            cursor: 'pointer',
          }}
          aria-label="Sort albums"
        >
          <option value="year">Year</option>
          <option value="title">Title</option>
          <option value="artist">Artist</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={albums.length === 0 ? 'No albums found' : 'No matching albums'}
          description={
            albums.length === 0
              ? 'Scan your library to add albums.'
              : 'Try a different search term.'
          }
        />
      ) : (
        <div
          className="album-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-4)',
          }}
        >
          {filtered.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      )}
    </div>
  );
};

Library.displayName = 'Library';
