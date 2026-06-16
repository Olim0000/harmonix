import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiShuffle, FiRepeat, FiVolume2, FiVolumeX, FiServer } from 'react-icons/fi';
import { usePlayerStore } from '../store/playerStore';
import { playOnServer, pauseOnServer, resumeOnServer, stopOnServer, seekOnServer, setVolumeOnServer, getServerStatus } from '../api/player';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';

const NATIVE_MAIN_SERVER = { id: 0, name: 'Main Server', host: window.location.hostname, port: 3001, builtin: true };

const formatTime = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const Player = () => {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const seekPending = useRef(false);
  const pollRef = useRef(null);
  const lastTrackIdRef = useRef(null);
  const prevServerRef = useRef(null);
  const prevStateRef = useRef(null);

  const {
    playing, currentTrack, volume, shuffle, repeat, currentTime, duration,
    activeServer, remoteStatus,
    play, pause, next, previous, setVolume, toggleShuffle, toggleRepeat,
    setCurrentTime, setDuration, seek, setActiveServer, setRemoteStatus,
  } = usePlayerStore();

  const [servers, setServers] = useState([]);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    client.get('/servers').then((r) => {
      const list = user?.is_admin
        ? [NATIVE_MAIN_SERVER, ...r.data]
        : r.data;
      setServers(list);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (activeServer) return;
    const el = audioRef.current;
    if (!el) return;
    if (playing && currentTrack) {
      el.play().catch(() => pause());
    } else {
      el.pause();
    }
  }, [playing, currentTrack, pause, activeServer]);

  const handleTimeUpdate = useCallback(() => {
    if (seekPending.current) return;
    setCurrentTime(audioRef.current?.currentTime || 0);
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    setDuration(audioRef.current?.duration || 0);
  }, [setDuration]);

  const handleEnded = useCallback(() => {
    if (repeat) {
      seek(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
      if (audioRef.current) audioRef.current.play().catch(() => {});
    } else {
      next();
    }
  }, [repeat, next, seek]);

  const handleProgressClick = useCallback((e) => {
    const bar = progressRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(frac * duration, duration));

    if (activeServer) {
      seekOnServer(activeServer, time).catch(() => {});
    }

    seekPending.current = true;
    seek(time);
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
    seekPending.current = false;
  }, [duration, seek, setCurrentTime, activeServer]);

  const toggleMute = useCallback(() => {
    const newVol = volume > 0 ? 0 : 1;
    setVolume(newVol);
    if (activeServer) {
      setVolumeOnServer(activeServer, Math.round(newVol * 100)).catch(() => {});
    }
  }, [volume, setVolume, activeServer]);

  const handleVolumeChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (activeServer) {
      setVolumeOnServer(activeServer, Math.round(val * 100)).catch(() => {});
    }
  }, [setVolume, activeServer]);

  const handleServerChange = useCallback((e) => {
    const val = e.target.value;
    if (!val) {
      if (activeServer) {
        stopOnServer(activeServer).catch(() => {});
      }
      setActiveServer(null);
      pause();
      return;
    }
    const parsed = JSON.parse(val);
    setActiveServer(parsed);
  }, [activeServer, setActiveServer, pause]);

  useEffect(() => {
    if (prevServerRef.current && prevServerRef.current !== activeServer) {
      stopOnServer(prevServerRef.current).catch(() => {});
      lastTrackIdRef.current = null;
      prevStateRef.current = null;
    }
    prevServerRef.current = activeServer;
  }, [activeServer]);

  useEffect(() => {
    if (!activeServer) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setRemoteStatus(null);
      return;
    }

    if (!playing) {
      if (currentTrack && lastTrackIdRef.current === currentTrack.id) {
        pauseOnServer(activeServer).catch(() => {});
      }
      return;
    }

    if (!currentTrack) return;

    if (lastTrackIdRef.current === currentTrack.id) {
      resumeOnServer(activeServer).catch(() => {});
    } else {
      lastTrackIdRef.current = currentTrack.id;
      playOnServer(activeServer, {
        streamUrl: currentTrack.stream_url,
        title: currentTrack.title,
        artist: currentTrack.artist,
        coverUrl: currentTrack.cover,
      }).catch(() => {});
    }
  }, [playing, currentTrack, activeServer, setRemoteStatus]);

  useEffect(() => {
    if (!activeServer || !playing) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const doPoll = async () => {
      try {
        const status = await getServerStatus(activeServer);
        setRemoteStatus(status);
        if (status.position != null) setCurrentTime(status.position);
        if (currentTrack?.duration_seconds) setDuration(currentTrack.duration_seconds);

        if (prevStateRef.current === 'playing' && status.state === 'stopped') {
          next();
        }
        prevStateRef.current = status.state;
      } catch {}
    };

    doPoll();
    pollRef.current = setInterval(doPoll, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeServer, playing, currentTrack, next, setCurrentTime, setDuration, setRemoteStatus]);

  const progressPct = activeServer
    ? (remoteStatus?.position != null && duration > 0)
      ? (remoteStatus.position / duration) * 100
      : 0
    : duration > 0 ? (currentTime / duration) * 100 : 0;

  const displayTime = activeServer
    ? (remoteStatus?.position || 0)
    : currentTime;

  return (
    <div className="player">
      <div className="player-left">
        {currentTrack ? (
          <div className="player-track">
            {currentTrack.cover && <img src={currentTrack.cover} alt="" />}
            <div className="player-track-info">
              <h3>{currentTrack.title}</h3>
              <p>{currentTrack.artist || 'Unknown Artist'}</p>
            </div>
          </div>
        ) : (
          <div className="player-empty">No track selected</div>
        )}
      </div>

      <div className="player-center">
        <div className="player-controls">
          <button
            type="button"
            className={`player-btn ${shuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
            title="Shuffle"
          >
            <FiShuffle size={16} />
          </button>

          <button type="button" className="player-btn" onClick={previous} disabled={!currentTrack} title="Previous">
            <FiSkipBack size={18} />
          </button>

          <button
            type="button"
            className="player-btn player-btn-play"
            onClick={() => (playing ? pause() : play())}
            disabled={!currentTrack}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <FiPause size={20} /> : <FiPlay size={20} />}
          </button>

          <button type="button" className="player-btn" onClick={next} disabled={!currentTrack} title="Next">
            <FiSkipForward size={18} />
          </button>

          <button
            type="button"
            className={`player-btn ${repeat ? 'active' : ''}`}
            onClick={toggleRepeat}
            title="Repeat"
          >
            <FiRepeat size={16} />
          </button>
        </div>

        <div className="player-progress" ref={progressRef} onClick={handleProgressClick} role="slider" tabIndex={0}>
          <div className="player-progress-track">
            <div className="player-progress-fill" style={{ width: `${progressPct}%` }} />
            <div className="player-progress-thumb" style={{ left: `${progressPct}%` }} />
          </div>
          <span className="player-time">{formatTime(displayTime)}</span>
          <span className="player-time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        {activeServer && (
          <span className="player-server-badge" title={`Playing on ${activeServer.name}`}>
            <FiServer size={12} /> {activeServer.name}
          </span>
        )}

        <button type="button" className="player-btn" onClick={toggleMute} title={volume > 0 ? 'Mute' : 'Unmute'}>
          {volume > 0 ? <FiVolume2 size={18} /> : <FiVolumeX size={18} />}
        </button>
        <input
          type="range"
          className="player-volume"
          min="0"
          max="1"
          step="0.02"
          value={volume}
          onChange={handleVolumeChange}
          title={`Volume: ${Math.round(volume * 100)}%`}
        />

        <select
          className="player-server-select"
          value={activeServer ? JSON.stringify(activeServer) : ''}
          onChange={handleServerChange}
          title="Playback target"
        >
          <option value="">Browser</option>
          {servers.map((s) => (
            <option key={s.id} value={JSON.stringify({ id: s.id, name: s.name, host: s.host, port: s.port })}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {!activeServer && (
        <audio
          ref={audioRef}
          src={currentTrack?.stream_url || ''}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
      )}
    </div>
  );
};

export default Player;
