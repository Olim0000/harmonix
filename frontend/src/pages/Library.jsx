import React, { useEffect, useState } from 'react';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import TrackRow from '../components/TrackRow';
import { usePlayerStore } from '../store/playerStore';

const Library = () => {
  const [tracks, setTracks] = useState([]);
  const [error, setError] = useState('');
  const { setQueue } = usePlayerStore();

  useEffect(() => {
    client.get('/tracks')
      .then((response) => {
        setTracks(response.data);
        setQueue(response.data);
      })
      .catch(() => setError('Could not load tracks. Make sure the backend is running on port 3001.'));
  }, [setQueue]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Library</h1>
          <p>{tracks.length} tracks</p>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="track-list">
          {tracks.map((track) => <TrackRow key={track.id} track={track} />)}
        </div>
      </main>
      <Player />
    </div>
  );
};

export default Library;
