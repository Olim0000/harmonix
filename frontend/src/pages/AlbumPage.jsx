import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import TrackRow from '../components/TrackRow';
import { usePlayerStore } from '../store/playerStore';

const AlbumPage = () => {
  const { artistId, albumName } = useParams();
  const decodedAlbum = decodeURIComponent(albumName);
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setQueue } = usePlayerStore();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get(`/artists/${artistId}`),
      client.get(`/albums/${artistId}/${albumName}/tracks`),
    ])
      .then(([artistRes, tracksRes]) => {
        setArtist(artistRes.data);
        setTracks(tracksRes.data);
        setQueue(tracksRes.data);
      })
      .catch(() => setError('Could not load album.'))
      .finally(() => setLoading(false));
  }, [artistId, albumName, setQueue]);

  const cover = useMemo(() => tracks.find((t) => t.cover)?.cover || null, [tracks]);
  const albumYear = decodedAlbum.match(/\((\d{4})\)$/)?.[1] || null;
  const albumDisplayName = albumYear ? decodedAlbum.replace(/\s+\(\d{4}\)$/, '') : decodedAlbum;

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <main className="content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {cover ? (
              <img src={cover} alt={decodedAlbum} style={{ width: '120px', height: '120px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '120px', height: '120px', borderRadius: '4px', background: 'var(--bg-surface)', flexShrink: 0 }} />
            )}
            <div>
              <h1 style={{ margin: 0 }}>{albumDisplayName}</h1>
              <p style={{ margin: '4px 0 0' }}>
                {artist && <Link to={`/artist/${artistId}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{artist.name}</Link>}
                {tracks.length > 0 && <> · {tracks.length} track{tracks.length !== 1 ? 's' : ''}</>}
                {albumYear && <> · <span className="album-year">{albumYear}</span></>}
              </p>
            </div>
          </div>
          {loading && <p className="loading-text">Loading album...</p>}
          {error && <p className="error-text">{error}</p>}
          <div className="track-list" style={{ marginTop: '16px' }}>
            {tracks.map((track) => <TrackRow key={track.id} track={track} />)}
          </div>
        </main>
      </div>
      <Player />
    </>
  );
};

export default AlbumPage;
