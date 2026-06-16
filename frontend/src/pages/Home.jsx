import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import TrackRow from '../components/TrackRow';
import { usePlayerStore } from '../store/playerStore';

const Home = () => {
  const [tracks, setTracks] = useState([]);
  const [error, setError] = useState('');
  const { setQueue } = usePlayerStore();

  useEffect(() => {
    client.get('/tracks')
      .then((response) => {
        setTracks(response.data);
        setQueue(response.data);
      })
      .catch(() => setError('Could not load your music library.'));
  }, [setQueue]);

  const recentTracks = useMemo(() => tracks.slice(0, 12), [tracks]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Harmonix</h1>
          <p>{tracks.length ? `${tracks.length} tracks ready` : 'Loading your music'}</p>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="track-list">
          {recentTracks.map((track) => <TrackRow key={track.id} track={track} />)}
        </div>
      </main>
      <Player />
    </div>
  );
};

export default Home;
