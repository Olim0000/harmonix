/**
 * Liked page (T31) — per DESIGN.md §4.9.
 * Three tabs: Tracks / Artists / Albums via likes API.
 */
import React, { useEffect, useState } from 'react';
import { fetchLikes } from '../api/library';
import { Tabs } from '../components/ui/Tab';
import { ListRow } from '../components/ui/ListRow';
import { AlbumCard } from '../components/ui/AlbumCard';
import { ArtistCard } from '../components/ui/ArtistCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { HeartIcon } from '../components/icons';
import { useUIStore } from '../stores/ui';
import type { LikeItem, Artist, Album } from '../types/api';

type TabId = 'tracks' | 'artists' | 'albums';

const tabs = [
  { id: 'tracks' as TabId, label: 'Tracks' },
  { id: 'artists' as TabId, label: 'Artists' },
  { id: 'albums' as TabId, label: 'Albums' },
];

export const Liked: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<TabId>('tracks');
  const [likeItems, setLikeItems] = useState<LikeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Map tab ID to API itemType (tab uses 'albums' plural, API uses 'album' singular)
    const apiType = activeTab === 'albums' ? 'album' as const : activeTab === 'artists' ? 'artist' as const : activeTab === 'tracks' ? 'track' as const : undefined;
    fetchLikes(apiType)
      .then(setLikeItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeTab]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load liked items" description={error} />;
  }

  return (
    <div>
      <h1 className="text-xl" style={{ marginBottom: 'var(--space-4)' }}>
        Liked
        {likeItems.length > 0 && (
          <span className="text-sm" style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
            ({likeItems.length})
          </span>
        )}
      </h1>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {likeItems.length === 0 ? (
        <EmptyState
          icon={<HeartIcon size={48} />}
          title={`No liked ${activeTab} yet`}
          description={`Tap the heart to save ${activeTab}.`}
        />
      ) : (
        <>
          {/* Tracks tab */}
          {activeTab === 'tracks' && (
            <div>
              {likeItems.map((item) => (
                <ListRow
                  key={`track-${item.itemId}`}
                  title={item.title || 'Unknown Track'}
                  subtitle={`${item.artist || ''}${item.album ? ` — ${item.album}` : ''}`}
                  trackId={item.itemId}
                  onPlay={() => addToast(`Play — TODO: P1c-2 player hookup`, 'info')}
                />
              ))}
            </div>
          )}

          {/* Artists tab */}
          {activeTab === 'artists' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 'var(--space-4)',
              }}
              className="artist-card-grid"
            >
              {likeItems.map((item) => (
                <ArtistCard
                  key={`artist-${item.itemId}`}
                  artist={{ id: item.itemId, name: item.name || 'Unknown', sort_name: null, image_path: null } as Artist}
                />
              ))}
            </div>
          )}

          {/* Albums tab */}
          {activeTab === 'albums' && (
            <div
              className="album-card-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 'var(--space-4)',
              }}
            >
              {likeItems.map((item) => (
                <AlbumCard
                  key={`album-${item.itemId}`}
                  album={{ id: item.itemId, artist_id: 0, title: item.title || 'Unknown', year: null, cover_path: null, artist_name: item.artist } as Album}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

Liked.displayName = 'Liked';
