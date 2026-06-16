import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import { usePlayerStore } from '../store/playerStore';

const ArtistPage = () => {
  const { id } = useParams();
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setQueue } = usePlayerStore();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get(`/artists/${id}`),
      client.get(`/artists/${id}/tracks`),
    ])
      .then(([artistResponse, tracksResponse]) => {
        setArtist(artistResponse.data);
        setTracks(tracksResponse.data);
        setQueue(tracksResponse.data);
      })
      .catch(() => setError('Could not load artist.'))
      .finally(() => setLoading(false));
  }, [id, setQueue]);

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
      <div className="app-shell">
        <Sidebar />
        <main className="content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {artist?.image_url && <img src={artist.image_url} alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />}
            <div>
              <h1>{artist?.name || 'Artist'}</h1>
              <p>{tracks.length} tracks{albumCards.length > 0 ? ` · ${albumCards.length} albums` : ''}</p>
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
        </main>
      </div>
      <Player />
    </>
  );
};

export default ArtistPage;
