import React, { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { usePlayerStore } from '../store/playerStore';

const TrackRow = ({ track }) => {
  const { currentTrack, play } = usePlayerStore();
  const active = currentTrack?.id === track.id;
  const [showPicker, setShowPicker] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [pickerError, setPickerError] = useState('');
  const [addingTo, setAddingTo] = useState(null);
  const [addedMsg, setAddedMsg] = useState('');
  const [creatingInline, setCreatingInline] = useState(false);
  const [inlineName, setInlineName] = useState('');
  const [inlineError, setInlineError] = useState('');

  useEffect(() => {
    if (showPicker) {
      setPickerError('');
      client.get('/playlists')
        .then((res) => setPlaylists(res.data))
        .catch(() => setPickerError('Failed to load playlists'));
    }
  }, [showPicker]);

  const handleAddToPlaylist = useCallback((playlistId) => {
    if (addingTo) return;
    setAddingTo(playlistId);
    setPickerError('');
    client.post(`/playlists/${playlistId}/tracks`, { trackId: track.id })
      .then(() => {
        setAddedMsg('Added!');
        setTimeout(() => { setAddedMsg(''); setShowPicker(false); }, 1200);
      })
      .catch((err) => {
        setPickerError(err.response?.data?.message || 'Failed to add track');
      })
      .finally(() => setAddingTo(null));
  }, [track.id, addingTo]);

  const handleCreateInline = useCallback(() => {
    if (!inlineName.trim() || creatingInline) return;
    setCreatingInline(true);
    setInlineError('');
    client.post('/playlists', { name: inlineName.trim() })
      .then((res) => {
        setPlaylists((prev) => [...prev, res.data]);
        setInlineName('');
      })
      .catch((err) => {
        setInlineError(err.response?.data?.message || 'Failed to create playlist');
      })
      .finally(() => setCreatingInline(false));
  }, [inlineName, creatingInline]);

  return (
    <>
      <div className="track-row-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          className={`track-row${active ? ' active' : ''}`}
          onClick={() => play(track)}
        >
          {track.cover ? <img src={track.cover} alt="" /> : <div className="track-cover-placeholder" />}
          <div>
            <h3>{track.title}</h3>
            <p>{track.artist || 'Unknown Artist'}{track.album ? ` - ${track.album}` : ''}</p>
          </div>
        </button>
        <div className="track-row-actions">
          <button type="button" onClick={() => setShowPicker(true)} title="Add to playlist">
            + Playlist
          </button>
        </div>
      </div>

      {showPicker && (
        <div className="modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add to playlist</h3>
            {addedMsg ? (
              <p>{addedMsg}</p>
            ) : (
              <>
                {pickerError && <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '8px' }}>{pickerError}</p>}
                {playlists.length > 0 ? (
                  <div className="playlist-picker-list">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        className="playlist-picker-item"
                        disabled={addingTo === pl.id}
                        onClick={() => handleAddToPlaylist(pl.id)}
                      >
                        {addingTo === pl.id ? 'Adding...' : pl.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>No playlists yet</p>
                    <input
                      type="text"
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      placeholder="New playlist name"
                      disabled={creatingInline}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateInline(); }}
                    />
                    {inlineError && <p style={{ fontSize: '0.85rem', color: '#999', margin: '4px 0 0' }}>{inlineError}</p>}
                    <button
                      type="button"
                      className="primary"
                      onClick={handleCreateInline}
                      disabled={creatingInline}
                      style={{ marginTop: '8px', padding: '6px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {creatingInline ? 'Creating...' : 'Create Playlist'}
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setShowPicker(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TrackRow;
