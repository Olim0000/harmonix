import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';

const Player = () => {
  const audioRef = useRef(null);
  const { playing, currentTrack, play, pause, next, previous } = usePlayerStore();

  useEffect(() => {
    if (!audioRef.current) return;

    if (playing && currentTrack) {
      audioRef.current.play().catch(() => pause());
    } else {
      audioRef.current.pause();
    }
  }, [playing, currentTrack, pause]);

  return (
    <div className="player">
      {currentTrack ? (
        <div className="player-track">
          {currentTrack.cover && <img src={currentTrack.cover} alt="" />}
          <div>
            <h3>{currentTrack.title}</h3>
            <p>{currentTrack.artist || 'Unknown Artist'}</p>
          </div>
        </div>
      ) : (
        <div className="player-empty">Select a track</div>
      )}

      <div className="player-controls">
        <button type="button" onClick={previous} disabled={!currentTrack}>Previous</button>
        <button type="button" onClick={() => (playing ? pause() : play())} disabled={!currentTrack}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={next} disabled={!currentTrack}>Next</button>
      </div>

      <audio
        ref={audioRef}
        src={currentTrack?.stream_url || ''}
        onEnded={next}
        controls
      />
    </div>
  );
};

export default Player;
