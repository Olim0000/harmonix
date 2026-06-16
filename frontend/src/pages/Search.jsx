import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import TrackRow from '../components/TrackRow';
import { usePlayerStore } from '../store/playerStore';

const Search = () => {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [error, setError] = useState('');
  const { setQueue } = usePlayerStore();

  useEffect(() => {
    client.get('/tracks')
      .then((response) => {
        setTracks(response.data);
        setQueue(response.data);
      })
      .catch(() => setError('Could not load tracks for search.'));
  }, [setQueue]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tracks;

    return tracks.filter((track) => (
      track.title?.toLowerCase().includes(term)
      || track.artist?.toLowerCase().includes(term)
      || track.album?.toLowerCase().includes(term)
    ));
  }, [query, tracks]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>Search</h1>
          <p>{results.length} results</p>
        </div>
        <input
          className="search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tracks, artists, albums"
        />
        {error && <p className="error-text">{error}</p>}
        <div className="track-list">
          {results.map((track) => <TrackRow key={track.id} track={track} />)}
        </div>
      </main>
      <Player />
    </div>
  );
};

export default Search;
