import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';

const Artists = () => {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    client.get('/artists')
      .then((res) => setArtists(res.data))
      .catch(() => setError('Could not load artists.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <main className="content">
          <div className="page-header">
            <h1>Artists</h1>
            <p>{artists.length} artists</p>
          </div>
          {loading && <p className="loading-text">Loading artists...</p>}
          {error && <p className="error-text">{error}</p>}
          <div className="artists-grid">
            {artists.map((artist) => (
              <Link key={artist.id} to={`/artist/${artist.id}`} className="artist-card">
                {artist.image_url ? (
                  <img src={artist.image_url} alt={artist.name} className="artist-card-img" />
                ) : (
                  <div className="artist-card-placeholder">{artist.name[0]}</div>
                )}
                <div className="artist-card-name">{artist.name}</div>
                <div className="artist-card-count">{artist.track_count} track{artist.track_count !== 1 ? 's' : ''}</div>
              </Link>
            ))}
          </div>
        </main>
      </div>
      <Player />
    </>
  );
};

export default Artists;
