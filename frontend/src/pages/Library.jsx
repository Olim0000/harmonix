import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import { usePlayerStore } from '../store/playerStore';
import { groupAlbums } from '../utils/albums';

const Library = () => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setQueue } = usePlayerStore();

  useEffect(() => {
    setLoading(true);
    client.get('/tracks')
      .then((response) => {
        setTracks(response.data);
        setQueue(response.data);
      })
      .catch(() => setError('Could not load tracks. Make sure the backend is running on port 3001.'))
      .finally(() => setLoading(false));
  }, [setQueue]);

  const albums = useMemo(() => {
    const all = groupAlbums(tracks);
    all.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return all;
  }, [tracks]);

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <main className="content">
          <div className="page-header">
            <h1>Library</h1>
            <p>{albums.length} album{albums.length !== 1 ? 's' : ''}</p>
          </div>
          {loading && <p className="loading-text">Loading tracks...</p>}
          {error && <p className="error-text">{error}</p>}
          {!loading && !error && (
            <div className="artists-grid">
              {albums.map((alb) => (
                <Link
                  key={`${alb.artist_id}|${alb.album}`}
                  to={`/album/${alb.artist_id}/${encodeURIComponent(alb.album)}`}
                  className="artist-card"
                >
                  {alb.cover ? (
                    <img src={alb.cover} alt={alb.album} className="album-card-img" />
                  ) : (
                    <div className="album-card-img-placeholder">{alb.displayName[0]}</div>
                  )}
                  <div className="artist-card-name">{alb.displayName}</div>
                  <div className="artist-card-count">{alb.artist} · {alb.trackCount} track{alb.trackCount !== 1 ? 's' : ''}</div>
                  {alb.year && <div className="album-year">{alb.year}</div>}
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
      <Player />
    </>
  );
};

export default Library;
