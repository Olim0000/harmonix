import React from 'react';
import { usePlayerStore } from '../store/playerStore';

const TrackRow = ({ track }) => {
  const { currentTrack, play } = usePlayerStore();
  const active = currentTrack?.id === track.id;

  return (
    <button
      type="button"
      className={`track-row${active ? ' active' : ''}`}
      onClick={() => play(track)}
    >
      {track.cover ? <img src={track.cover} alt="" /> : <div className="track-cover-placeholder" />}
      <div>
        <h3>{track.title}</h3>
        <p>{track.artist || 'Unknown Artist'}{track.album ? ` - ${track.album}` : ''}</p>
      </div>
    </button>
  );
};

export default TrackRow;
