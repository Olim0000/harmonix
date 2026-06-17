import React, { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import { usePlayer } from '../store/PlayerContext';
import { FiHeart } from '../icons';

// ponytail: module-level cache — one API call shared across all TrackRow instances
let likedCache = null;
let likedPromise = null;

const TrackRow = ({ track }) => {
  const { currentTrack, play, addToQueue } = usePlayer();
  const [liked, setLiked] = useState(likedCache?.has(track.id) || false);
  const [showPicker, setShowPicker] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    if (likedCache) { setLiked(likedCache.has(String(track.id))); return; }
    if (!likedPromise) likedPromise = client.get('/likes?itemType=track').then(r => {
      likedCache = new Set(r.data.map(t => t.item_id));
      setLiked(likedCache.has(String(track.id)));
    }).catch(() => {});
  }, [track.id]);

  useEffect(() => {
    if (showPicker) client.get('/playlists').then((r) => setPlaylists(r.data)).catch(() => {});
  }, [showPicker]);

  const handleQueue = useCallback(() => {
    addToQueue(track);
    setMsg('Queued!');
    setTimeout(() => setMsg(''), 1200);
  }, [track, addToQueue]);

  const handleAddToPlaylist = useCallback(async (playlistId) => {
    if (adding) return;
    setAdding(playlistId);
    try {
      await client.post(`/playlists/${playlistId}/tracks`, { trackId: track.id });
      setMsg('Added!');
      setTimeout(() => { setMsg(''); setShowPicker(false); }, 1200);
    } catch {}
    setAdding(null);
  }, [track.id, adding]);

  const toggleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    if (next) likedCache.add(String(track.id)); else likedCache.delete(String(track.id));
    (next ? client.post('/likes', { itemType: 'track', itemId: String(track.id) }) : client.delete(`/likes/track/${track.id}`)).catch(() => {
      setLiked(liked);
      if (liked) likedCache.add(String(track.id)); else likedCache.delete(String(track.id));
    });
  }, [track.id, liked]);

  return (
    <div className="track-row-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
      <button type="button" className={`track-row${currentTrack?.id === track.id ? ' active' : ''}`}
        onClick={() => { play(track); addToQueue(track); }}>
        {track.cover ? <img src={track.cover} alt="" /> : <div className="track-cover-placeholder" />}
        <div>
          <h3>{track.title}</h3>
          <p>{track.artist || 'Unknown Artist'}{track.album ? ` - ${track.album}` : ''}</p>
        </div>
      </button>
      <div className="track-row-actions">
        <button type="button" onClick={handleQueue}>{msg || '+ Queue'}</button>
        <button type="button" onClick={() => setShowPicker(true)}>+ Playlist</button>
        <button type="button" className={`track-like-btn${liked ? ' liked' : ''}`} onClick={toggleLike} title={liked ? 'Unlike' : 'Like'}>
          <FiHeart size={14} filled={liked} />
        </button>
      </div>

      {showPicker && (
        <div className="modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add to playlist</h3>
            {msg ? <p>{msg}</p> : (
              <div className="playlist-picker-list">
                {playlists.map((pl) => (
                  <button key={pl.id} type="button" className="playlist-picker-item" disabled={adding === pl.id} onClick={() => handleAddToPlaylist(pl.id)}>
                    {adding === pl.id ? 'Adding...' : pl.name}
                  </button>
                ))}
                {playlists.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No playlists yet</p>}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setShowPicker(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackRow;