import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import { usePlayer } from '../store/PlayerContext';
import { FiHeart } from '../icons';

// ponytail: module-level cache for artist likes
let artistLikedCache = null;
let artistLikedPromise = null;

const ArtistPage = () => {
  const { id } = useParams();
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState('');
  const { play, addToQueue } = usePlayer();

  useEffect(() => {
    if (artistLikedCache) { setLiked(artistLikedCache.has(id)); return; }
    if (!artistLikedPromise) artistLikedPromise = client.get('/likes?itemType=artist').then(r => {
      artistLikedCache = new Set(r.data.map(t => t.item_id));
      setLiked(artistLikedCache.has(id));
    }).catch(() => {});
  }, [id]);

  const toggleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    if (next) artistLikedCache.add(id); else artistLikedCache.delete(id);
    (next ? client.post('/likes', { itemType: 'artist', itemId: id }) : client.delete(`/likes/artist/${id}`)).catch(() => {
      setLiked(liked);
      if (liked) artistLikedCache.add(id); else artistLikedCache.delete(id);
    });
  }, [id, liked]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get(`/artists/${id}`),
      client.get(`/artists/${id}/tracks`),
    ])
      .then(([artistResponse, tracksResponse]) => {
        setArtist(artistResponse.data);
        setTracks(tracksResponse.data);
      })
      .catch(() => setError('Could not load artist.'))
      .finally(() => setLoading(false));
  }, [id]);

  const albumCards = useMemo(() => {
    const seen = new Set();
    const albums = [];
    for (const track of tracks) {
      const album = track.album || 'Unknown Album';
      const key = `${id}|${album}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const m = album.match(/^(.*?)\s+\((\d{4})\)$/);
      albums.push({
        album,
        displayName: m ? m[1] : album,
        year: m ? m[2] : null,
        cover: track.cover || null,
        trackCount: tracks.filter((t) => (t.album || 'Unknown Album') === album).length,
      });
    }
    return albums;
  }, [tracks, id]);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {artist?.image_url && <img src={artist.image_url} alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />}
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {artist?.name || 'Artist'}
            <button type="button" className={`like-btn${liked ? ' liked' : ''}`} onClick={toggleLike} title={liked ? 'Unlike' : 'Like'}>
              <FiHeart size={20} filled={liked} />
            </button>
          </h1>
          <p>{tracks.length} tracks{albumCards.length > 0 ? ` · ${albumCards.length} albums` : ''}</p>
          {tracks.length > 0 && (
            <button type="button" onClick={() => { tracks.forEach(t => addToQueue(t)); play(tracks[0]); }} style={{ marginTop: '8px', padding: '6px 14px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              + Add to Queue
            </button>
          )}
        </div>
      </div>
      {loading && <p className="loading-text">Loading artist...</p>}
      {artist?.bio && <p className="muted-copy">{artist.bio}</p>}
      {error && <p className="error-text">{error}</p>}
      <div className="artists-grid">
        {albumCards.map((alb) => (
          <Link
            key={alb.album}
            to={`/album/${id}/${encodeURIComponent(alb.album)}`}
            className="artist-card"
          >
            {alb.cover ? (
              <img src={alb.cover} alt={alb.album} className="album-card-img" />
            ) : (
              <div className="album-card-img-placeholder">{alb.album[0]}</div>
            )}
            <div className="artist-card-name">{alb.displayName}</div>
            <div className="artist-card-count">{alb.trackCount} track{alb.trackCount !== 1 ? 's' : ''}</div>
            {alb.year && <div className="album-year">{alb.year}</div>}
          </Link>
        ))}
      </div>
    </>
  );
};

export default ArtistPage;
