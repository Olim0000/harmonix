import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiShuffle, FiRepeat, FiVolume2, FiVolumeX, FiServer, FiChevronDown } from 'react-icons/fi';
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
  const pollRef = useRef(null);
  const lastTrackIdRef = useRef(null);
  const prevServerRef = useRef(null);
  const prevStateRef = useRef(null);
  const seekTimerRef = useRef(null);
  const fullscreenProgressRef = useRef(null);
  const seekGuardRef = useRef(0);
  const [fullScreen, setFullScreen] = useState(false);

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
    if (performance.now() < seekGuardRef.current) return;
    setCurrentTime(audioRef.current?.currentTime || 0);
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    setDuration(audioRef.current?.duration || 0);
  }, [setDuration]);

  const doSeek = useCallback((time, immediateServer) => {
    const t = Math.max(0, Math.min(time, duration || 0));
    seek(t);
    seekGuardRef.current = performance.now() + 500;

    const apply = () => {
      if (audioRef.current) audioRef.current.currentTime = t;
      if (activeServer) seekOnServer(activeServer, t).catch(() => {});
    };

    if (immediateServer) {
      apply();
    } else {
      if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
      seekTimerRef.current = setTimeout(apply, 300);
    }
  }, [duration, activeServer, seek]);

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
    doSeek(frac * duration, true);
  }, [duration, doSeek]);

  const handleFullscreenProgressClick = useCallback((e) => {
    const bar = fullscreenProgressRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    doSeek(frac * duration, true);
  }, [duration, doSeek]);

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
      if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;

      switch (e.code) {
        case 'Escape':
          if (fullScreen) setFullScreen(false);
          break;
        case 'Space':
          e.preventDefault();
          if (currentTrack) {
            if (playing) pause(); else play();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (duration > 0) {
            const cur = activeServer ? (remoteStatus?.position || 0) : currentTime;
            doSeek(cur - 5, false);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (duration > 0) {
            const cur = activeServer ? (remoteStatus?.position || 0) : currentTime;
            doSeek(cur + 5, false);
          }
          break;
        case 'KeyN':
          if (currentTrack) next();
          break;
        case 'KeyP':
          if (currentTrack) previous();
          break;
        case 'KeyM':
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playing, currentTrack, duration, activeServer, remoteStatus, pause, play, next, previous, doSeek, toggleMute, fullScreen]);

  const progressPct = activeServer
    ? (remoteStatus?.position != null && duration > 0)
      ? (remoteStatus.position / duration) * 100
      : 0
    : duration > 0 ? (currentTime / duration) * 100 : 0;

  const displayTime = activeServer
    ? (remoteStatus?.position || 0)
    : currentTime;

  return (
    <>
    <div className="player">
      <div className="player-left" onClick={currentTrack ? () => setFullScreen(true) : undefined} style={currentTrack ? { cursor: 'pointer' } : undefined}>
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

        <div className="player-progress" role="slider" tabIndex={0}>
          <div className="player-progress-track" ref={progressRef} onClick={handleProgressClick}>
            <div className="player-progress-fill" style={{ width: `${progressPct}%` }} />
            <div className="player-progress-thumb" style={{ left: `${progressPct}%` }} />
          </div>
          <span className="player-time hide-mobile">{formatTime(displayTime)}</span>
          <span className="player-time hide-mobile">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        {activeServer && (
          <span className="player-server-badge" title={`Playing on ${activeServer.name}`}>
            <FiServer size={12} /> {activeServer.name}
          </span>
        )}

        <button type="button" className="player-btn hide-mobile" onClick={toggleMute} title={volume > 0 ? 'Mute' : 'Unmute'}>
          {volume > 0 ? <FiVolume2 size={18} /> : <FiVolumeX size={18} />}
        </button>
        <input
          type="range"
          className="player-volume hide-mobile"
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

    {fullScreen && currentTrack && (
      <div className="player-fullscreen" onClick={() => setFullScreen(false)}>
        <div className="player-fullscreen-content" onClick={(e) => e.stopPropagation()}>
          <button className="player-fullscreen-close" onClick={() => setFullScreen(false)}>
            <FiChevronDown size={24} />
          </button>

          <div className="player-fullscreen-art">
            {currentTrack.cover
              ? <img src={currentTrack.cover} alt="" />
              : <div className="player-fullscreen-art-placeholder" />
            }
          </div>

          <div className="player-fullscreen-info">
            <h2>{currentTrack.title}</h2>
            <p>{currentTrack.artist || 'Unknown Artist'}</p>
          </div>

          <div className="player-fullscreen-progress" ref={fullscreenProgressRef} onClick={handleFullscreenProgressClick} role="slider" tabIndex={0}>
            <div className="player-fullscreen-progress-track">
              <div className="player-fullscreen-progress-fill" style={{ width: `${progressPct}%` }} />
              <div className="player-fullscreen-progress-thumb" style={{ left: `${progressPct}%` }} />
            </div>
            <div className="player-fullscreen-time">
              <span>{formatTime(displayTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-fullscreen-controls">
            <button type="button" className={`player-btn ${shuffle ? 'active' : ''}`} onClick={toggleShuffle} title="Shuffle"><FiShuffle size={20} /></button>
            <button type="button" className="player-btn" onClick={previous} disabled={!currentTrack} title="Previous"><FiSkipBack size={22} /></button>
            <button type="button" className="player-btn player-btn-play" onClick={() => (playing ? pause() : play())} disabled={!currentTrack} title={playing ? 'Pause' : 'Play'}>
              {playing ? <FiPause size={28} /> : <FiPlay size={28} />}
            </button>
            <button type="button" className="player-btn" onClick={next} disabled={!currentTrack} title="Next"><FiSkipForward size={22} /></button>
            <button type="button" className={`player-btn ${repeat ? 'active' : ''}`} onClick={toggleRepeat} title="Repeat"><FiRepeat size={20} /></button>
          </div>

          <div className="player-fullscreen-volume">
            <button type="button" className="player-btn" onClick={toggleMute} title={volume > 0 ? 'Mute' : 'Unmute'}>
              {volume > 0 ? <FiVolume2 size={18} /> : <FiVolumeX size={18} />}
            </button>
            <input type="range" min="0" max="1" step="0.02" value={volume} onChange={handleVolumeChange} title={`Volume: ${Math.round(volume * 100)}%`} />
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Player;
