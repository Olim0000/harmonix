import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import PageLayout from '../components/PageLayout';
import TrackRow from '../components/TrackRow';
import { usePlayer } from '../store/PlayerContext';
import { FiHeart } from '../icons';

// ponytail: module-level cache for album likes
let albumLikedCache = null;
let albumLikedPromise = null;

const AlbumPage = () => {
  const { artistId, albumName } = useParams();
  const decodedAlbum = decodeURIComponent(albumName);
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState('');
  const { play, addToQueue } = usePlayer();

  const albumItemId = `${artistId}:${decodedAlbum}`;

  useEffect(() => {
    if (albumLikedCache) { setLiked(albumLikedCache.has(albumItemId)); return; }
    if (!albumLikedPromise) albumLikedPromise = client.get('/likes?itemType=album').then(r => {
      albumLikedCache = new Set(r.data.map(t => t.item_id));
      setLiked(albumLikedCache.has(albumItemId));
    }).catch(() => {});
  }, [albumItemId]);

  const toggleLike = useCallback(() => {
    const next = !liked;
    setLiked(next);
    if (next) albumLikedCache.add(albumItemId); else albumLikedCache.delete(albumItemId);
    (next ? client.post('/likes', { itemType: 'album', itemId: albumItemId }) : client.delete(`/likes/album/${encodeURIComponent(albumItemId)}`)).catch(() => {
      setLiked(liked);
      if (liked) albumLikedCache.add(albumItemId); else albumLikedCache.delete(albumItemId);
    });
  }, [albumItemId, liked]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get(`/artists/${artistId}`),
      client.get(`/albums/${artistId}/${albumName}/tracks`),
    ])
      .then(([artistRes, tracksRes]) => {
        setArtist(artistRes.data);
        setTracks(tracksRes.data);
      })
      .catch(() => setError('Could not load album.'))
      .finally(() => setLoading(false));
  }, [artistId, albumName]);

  const cover = useMemo(() => tracks.find((t) => t.cover)?.cover || null, [tracks]);
  const albumYear = decodedAlbum.match(/\((\d{4})\)$/)?.[1] || null;
  const albumDisplayName = albumYear ? decodedAlbum.replace(/\s+\(\d{4}\)$/, '') : decodedAlbum;

  return (
    <>
      <PageLayout>
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {cover ? (
            <img src={cover} alt={decodedAlbum} style={{ width: '120px', height: '120px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '120px', height: '120px', borderRadius: '4px', background: 'var(--bg-surface)', flexShrink: 0 }} />
          )}
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              {albumDisplayName}
              <button type="button" className={`like-btn${liked ? ' liked' : ''}`} onClick={toggleLike} title={liked ? 'Unlike' : 'Like'}>
                <FiHeart size={20} filled={liked} />
              </button>
            </h1>
            <p style={{ margin: '4px 0 0' }}>
              {artist && <Link to={`/artist/${artistId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{artist.name}</Link>}
              {tracks.length > 0 && <> · {tracks.length} track{tracks.length !== 1 ? 's' : ''}</>}
              {albumYear && <> · <span className="album-year">{albumYear}</span></>}
            </p>
            {tracks.length > 0 && (
              <button type="button" onClick={() => { tracks.forEach(t => addToQueue(t)); play(tracks[0]); }} style={{ marginTop: '8px', padding: '6px 14px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                + Add to Queue
              </button>
            )}
          </div>
        </div>
        {loading && <p className="loading-text">Loading album...</p>}
        {error && <p className="error-text">{error}</p>}
        <div className="track-list" style={{ marginTop: '16px' }}>
          {tracks.map((track) => <TrackRow key={track.id} track={track} />)}
        </div>
      </PageLayout>
    </>
  );
};

export default AlbumPage;
