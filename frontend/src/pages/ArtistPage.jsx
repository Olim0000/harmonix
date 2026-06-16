import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import TrackRow from '../components/TrackRow';
import { usePlayerStore } from '../store/playerStore';

const ArtistPage = () => {
  const { id } = useParams();
  const [artist, setArtist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [error, setError] = useState('');
  const { setQueue } = usePlayerStore();

  useEffect(() => {
    Promise.all([
      client.get(`/artists/${id}`),
      client.get('/tracks'),
    ])
      .then(([artistResponse, tracksResponse]) => {
        setArtist(artistResponse.data);
        setTracks(tracksResponse.data);
        setQueue(tracksResponse.data);
      })
      .catch(() => setError('Could not load artist.'));
  }, [id, setQueue]);

  const artistTracks = useMemo(
    () => tracks.filter((track) => String(track.artist_id) === String(id)),
    [id, tracks]
  );

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        <div className="page-header">
          <h1>{artist?.name || 'Artist'}</h1>
          <p>{artistTracks.length} tracks</p>
        </div>
        {artist?.bio && <p className="muted-copy">{artist.bio}</p>}
        {error && <p className="error-text">{error}</p>}
        <div className="track-list">
          {artistTracks.map((track) => <TrackRow key={track.id} track={track} />)}
        </div>
      </main>
      <Player />
    </div>
  );
};

export default ArtistPage;
