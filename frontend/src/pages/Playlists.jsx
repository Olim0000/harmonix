import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';

const formatDuration = (seconds) => {
  if (!seconds) return '0 min';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs} hr ${mins} min`;
  return `${mins} min`;
};

const Playlists = () => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    setLoading(true);
    client.get('/playlists')
      .then((res) => setPlaylists(res.data))
      .catch(() => setError('Could not load playlists.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = playlists.filter((pl) =>
    pl.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = useCallback(() => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setCreateError('');
    client.post('/playlists', { name: newName.trim() })
      .then((res) => {
        setPlaylists((prev) => [res.data, ...prev]);
        setNewName('');
        setShowCreate(false);
      })
      .catch((err) => {
        setCreateError(err.response?.data?.message || 'Failed to create playlist');
      })
      .finally(() => setCreating(false));
  }, [newName, creating]);

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <main className="content">
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1>Playlists</h1>
              <p>{playlists.length} playlist{playlists.length !== 1 ? 's' : ''}</p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowCreate(true)}
            >
              New Playlist
            </button>
          </div>
          {loading && <p className="loading-text">Loading playlists...</p>}
          {error && <p className="error-text">{error}</p>}
          {!loading && !error && (
            <>
              <input
                type="text"
                className="search-input"
                placeholder="Search playlists..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="artists-grid">
                {filtered.map((pl) => (
                  <Link key={pl.id} to={`/playlist/${pl.id}`} className="artist-card">
                    <div className="artist-card-placeholder" style={{ fontSize: '1.8rem' }}>♪</div>
                    <div className="artist-card-name">{pl.name}</div>
                    <div className="artist-card-count">
                      {pl.track_count} track{pl.track_count !== 1 ? 's' : ''}
                    </div>
                    <div className="artist-card-count" style={{ fontSize: '0.75rem' }}>
                      {formatDuration(pl.total_duration)}
                    </div>
                  </Link>
                ))}
                {filtered.length === 0 && (
                  <p className="muted-copy" style={{ gridColumn: '1 / -1' }}>
                    {search ? 'No playlists match your search.' : 'No playlists yet. Create one to get started.'}
                  </p>
                )}
              </div>
            </>
          )}
        </main>

        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>New Playlist</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name"
                autoFocus
                disabled={creating}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              />
              {createError && <p style={{ fontSize: '0.85rem', color: '#ff7b7b', margin: '8px 0 0' }}>{createError}</p>}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
                <button type="button" className="primary" onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Player />
    </>
  );
};

export default Playlists;
