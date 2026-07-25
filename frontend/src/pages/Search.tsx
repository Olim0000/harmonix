/**
 * Search page (T30) — per DESIGN.md §4.8.
 * Debounced 300ms input → API search. Segmented control: All/Albums/Tracks.
 */
import React, { useEffect, useState, useRef } from 'react';
import { search } from '../api/library';
import { Input } from '../components/ui/Input';
import { AlbumCard } from '../components/ui/AlbumCard';
import { ListRow } from '../components/ui/ListRow';
import { Tabs } from '../components/ui/Tab';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { SearchIcon } from '../components/icons';
import { useDebounce } from '../hooks/useDebounce';
import { useUIStore } from '../stores/ui';
import type { SearchResult } from '../types/api';

type TabId = 'all' | 'albums' | 'tracks';

const tabs = [
  { id: 'all' as TabId, label: 'All' },
  { id: 'albums' as TabId, label: 'Albums' },
  { id: 'tracks' as TabId, label: 'Tracks' },
];

export const Search: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    search(debouncedQuery.trim())
      .then(setResults)
      .catch(() => {
        addToast('Search failed', 'error');
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery, addToast]);

  // Focus input on mount and when "/" is pressed globally
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const albums = results.filter((r) => r.type === 'album').slice(0, 8);
  const tracks = results.filter((r) => r.type === 'track').slice(0, 30);

  const renderResults = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <Spinner size={24} />
        </div>
      );
    }

    if (results.length === 0 && debouncedQuery.trim()) {
      return (
        <EmptyState
          title={`No results for "${debouncedQuery}"`}
          description="Try a different search term."
        />
      );
    }

    if (results.length === 0) {
      return null;
    }

    return (
      <>
        {(activeTab === 'all' || activeTab === 'albums') && albums.length > 0 && (
          <section style={{ marginBottom: 'var(--space-6)' }}>
            <h2 className="text-base" style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>
              Albums
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {albums.map((album) => (
                <AlbumCard
                  key={`album-${album.id}`}
                  album={{
                    id: album.id,
                    artist_id: 0,
                    title: album.title,
                    year: album.year ?? null,
                    cover_path: album.cover_path ?? null,
                    artist_name: album.artist_name,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {(activeTab === 'all' || activeTab === 'tracks') && tracks.length > 0 && (
          <section>
            {activeTab === 'all' && (
              <h2 className="text-base" style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                Tracks
              </h2>
            )}
            <div>
              {tracks.map((track) => (
                <ListRow
                  key={`track-${track.id}`}
                  title={track.title}
                  subtitle={`${track.artist_name}${track.album_title ? ` — ${track.album_title}` : ''}`}
                  duration={track.duration_seconds}
                  trackId={track.id}
                  onPlay={() => addToast(`Play "${track.title}" — TODO: P1c-2`, 'info')}
                />
              ))}
            </div>
          </section>
        )}
      </>
    );
  };

  return (
    <div>
      <div style={{ maxWidth: 600, margin: '0 auto var(--space-6)' }}>
        <Input
          ref={inputRef}
          variant="search"
          placeholder='Search albums, artists, tracks… (Press "/")'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
          style={{ height: 48, fontSize: 16 }}
        />
      </div>

      {debouncedQuery.trim() && results.length > 0 && (
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />
      )}

      {renderResults()}

      {!debouncedQuery.trim() && !loading && (
        <EmptyState
          icon={<SearchIcon size={48} />}
          title="Search your library"
          description="Start typing to find albums, artists, and tracks."
        />
      )}
    </div>
  );
};

Search.displayName = 'Search';
