import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import TrackRow from '../components/TrackRow';

const Liked = () => {
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/likes?itemType=track&full=true'),
      client.get('/likes?itemType=artist&full=true'),
      client.get('/likes?itemType=album&full=true'),
    ]).then(([tracksRes, artistsRes, albumsRes]) => {
      setTracks(tracksRes.data);
      setArtists(artistsRes.data);
      setAlbums(albumsRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Liked</h1>
      </div>
      {loading && <p className="loading-text">Loading...</p>}
      {!loading && (
        <>
          {tracks.length > 0 && (
            <>
              <h2 className="album-header">Tracks</h2>
              <div className="track-list">
                {tracks.map((track) => <TrackRow key={track.id} track={track} />)}
              </div>
            </>
          )}
          {artists.length > 0 && (
            <>
              <h2 className="album-header" style={{ marginTop: '24px' }}>Artists</h2>
              <div className="artists-grid">
                {artists.map((a) => (
                  <Link key={a.id} to={`/artist/${a.id}`} className="artist-card">
                    {a.image_url ? (
                      <img src={a.image_url} alt={a.name} className="artist-card-img" />
                    ) : (
                      <div className="artist-card-placeholder">{a.name[0]}</div>
                    )}
                    <div className="artist-card-name">{a.name}</div>
                  </Link>
                ))}
              </div>
            </>
          )}
          {albums.length > 0 && (
            <>
              <h2 className="album-header" style={{ marginTop: '24px' }}>Albums</h2>
              <div className="artists-grid">
                {albums.map((a) => (
                  <Link key={`${a.artist_id}|${a.album}`} to={`/album/${a.artist_id}/${encodeURIComponent(a.album)}`} className="artist-card">
                    {a.cover ? (
                      <img src={a.cover} alt={a.album} className="album-card-img" />
                    ) : (
                      <div className="album-card-img-placeholder">{(a.album || '?')[0]}</div>
                    )}
                    <div className="artist-card-name">{a.artist} — {a.album}</div>
                    <div className="artist-card-count">{a.track_count} tracks</div>
                  </Link>
                ))}
              </div>
            </>
          )}
          {tracks.length === 0 && artists.length === 0 && albums.length === 0 && (
            <p className="loading-text">Nothing liked yet.</p>
          )}
        </>
      )}
    </>
  );
};

export default Liked;
