import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import TrackRow from '../components/TrackRow';
import { usePlayerStore } from '../store/playerStore';

const Playlist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [removeError, setRemoveError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { setQueue } = usePlayerStore();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get(`/playlists/${id}`),
      client.get(`/playlists/${id}/tracks`),
    ])
      .then(([playlistRes, tracksRes]) => {
        setPlaylist(playlistRes.data);
        setTracks(tracksRes.data);
        setQueue(tracksRes.data);
      })
      .catch(() => setError('Could not load playlist.'))
      .finally(() => setLoading(false));
  }, [id, setQueue]);

  const handleRemoveTrack = useCallback((trackId) => {
    if (removing) return;
    setRemoving(trackId);
    setRemoveError('');
    client.delete(`/playlists/${id}/tracks/${trackId}`)
      .then(() => {
        setTracks((prev) => {
          const updated = prev.filter((t) => t.id !== trackId);
          setQueue(updated);
          return updated;
        });
      })
      .catch((err) => {
        setRemoveError(err.response?.data?.message || 'Failed to remove track');
      })
      .finally(() => setRemoving(null));
  }, [id, setQueue, removing]);

  const handleDeletePlaylist = useCallback(() => {
    if (deleting) return;
    setDeleting(true);
    setRemoveError('');
    client.delete(`/playlists/${id}`)
      .then(() => navigate('/library'))
      .catch((err) => {
        setRemoveError(err.response?.data?.message || 'Failed to delete playlist');
      })
      .finally(() => setDeleting(false));
  }, [id, navigate, deleting]);

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <main className="content">
          <div className="page-header">
            <h1>{playlist?.name || 'Playlist'}</h1>
            <p>{tracks.length} tracks</p>
          </div>
          {loading && <p className="loading-text">Loading playlist...</p>}
          {error && <p className="error-text">{error}</p>}
          {removeError && <p style={{ color: '#999', fontSize: '0.9rem', margin: '8px 0' }}>{removeError}</p>}
          <div className="playlist-actions">
            <button type="button" className="btn-danger" onClick={handleDeletePlaylist} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Playlist'}
            </button>
          </div>
          <div className="track-list">
            {tracks.map((track) => (
              <div key={track.id} className="track-row-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <TrackRow track={track} />
                </div>
                <div className="track-row-actions">
                  <button
                    type="button"
                    onClick={() => handleRemoveTrack(track.id)}
                    disabled={removing === track.id}
                    title="Remove from playlist"
                  >
                    {removing === track.id ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
      <Player />
    </>
  );
};

export default Playlist;
