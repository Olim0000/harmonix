import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import TrackRow from '../components/TrackRow';
import { usePlayerStore } from '../store/playerStore';
import { groupAlbums, shuffle } from '../utils/albums';

const Search = () => {
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setQueue } = usePlayerStore();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get('/tracks'),
      client.get('/artists'),
    ])
      .then(([tracksRes, artistsRes]) => {
        setTracks(tracksRes.data);
        setArtists(artistsRes.data);
        setQueue(tracksRes.data);
      })
      .catch(() => setError('Could not load tracks for search.'))
      .finally(() => setLoading(false));
  }, [setQueue]);

  const term = query.trim().toLowerCase();

  const matchingArtists = useMemo(() => {
    if (!term) return [];
    return artists.filter((a) => a.name?.toLowerCase().includes(term));
  }, [term, artists]);

  const matchingAlbums = useMemo(() => {
    if (!term) return [];
    return groupAlbums(tracks).filter((a) => (
      a.album?.toLowerCase().includes(term)
      || a.artist?.toLowerCase().includes(term)
    ));
  }, [term, tracks]);

  const matchingTracks = useMemo(() => {
    if (!term) return [];
    return tracks.filter((track) => (
      track.title?.toLowerCase().includes(term)
      || track.artist?.toLowerCase().includes(term)
      || track.album?.toLowerCase().includes(term)
    ));
  }, [term, tracks]);

  const totalResults = term
    ? matchingArtists.length + matchingAlbums.length + matchingTracks.length
    : tracks.length;

  const randomAlbums = useMemo(() => {
    if (term) return [];
    return shuffle(groupAlbums(tracks)).slice(0, 12);
  }, [term, tracks]);

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <main className="content">
          <div className="page-header">
            <h1>Search</h1>
            <p>{totalResults} results</p>
          </div>
          <input
            className="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, artists, albums"
          />
          {loading && <p className="loading-text">Loading tracks...</p>}
          {error && <p className="error-text">{error}</p>}

          {!term && !loading && !error && (
            <>
              <h2 className="album-header" style={{ marginTop: '16px' }}>Albums</h2>
              <div className="artists-grid" style={{ marginBottom: '24px' }}>
                {randomAlbums.map((alb) => (
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
            </>
          )}

          {matchingArtists.length > 0 && (
            <>
              <h2 className="album-header" style={{ marginTop: '16px' }}>Artists</h2>
              <div className="artists-grid" style={{ marginBottom: '24px' }}>
                {matchingArtists.map((artist) => (
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
            </>
          )}

          {matchingAlbums.length > 0 && (
            <>
              <h2 className="album-header" style={{ marginTop: '16px' }}>Albums</h2>
              <div className="artists-grid" style={{ marginBottom: '24px' }}>
                {matchingAlbums.map((alb) => (
                  <Link
                    key={`${alb.artist_id}|${alb.album}`}
                    to={`/album/${alb.artist_id}/${encodeURIComponent(alb.album)}`}
                    className="artist-card"
                  >
                    {alb.cover ? (
                      <img src={alb.cover} alt={alb.album} className="album-card-img" />
                    ) : (
                      <div className="album-card-img-placeholder">{alb.album[0]}</div>
                    )}
                    <div className="artist-card-name">{alb.displayName}</div>
                    <div className="artist-card-count">{alb.artist} · {alb.trackCount} track{alb.trackCount !== 1 ? 's' : ''}</div>
                    {alb.year && <div className="album-year">{alb.year}</div>}
                  </Link>
                ))}
              </div>
            </>
          )}

          {matchingTracks.length > 0 && (
            <h2 className="album-header" style={{ marginTop: '16px' }}>Tracks</h2>
          )}
          {matchingTracks.length > 0 && (
            <div className="track-list">
              {matchingTracks.map((track) => <TrackRow key={track.id} track={track} />)}
            </div>
          )}
        </main>
      </div>
      <Player />
    </>
  );
};

export default Search;
