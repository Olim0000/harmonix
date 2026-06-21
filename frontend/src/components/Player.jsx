import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiShuffle, FiRepeat, FiVolume2, FiVolumeX, FiServer, FiChevronDown, FiMaximize2, FiList, FiChevronUp, FiX } from '../icons';
import { usePlayer } from '../store/PlayerContext';
import { playOnServer, pauseOnServer, resumeOnServer, stopOnServer, seekOnServer, setVolumeOnServer, getServerStatus } from '../api/player';
import { useAuth } from '../store/AuthContext';
import client from '../api/client';

const NATIVE_MAIN_SERVER = { id: 0, name: 'Main Server', host: window.location.hostname, port: 3001, builtin: true };

const formatTime = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const PlayerControls = ({ playing, shuffle, repeat, currentTrack, onPlayPause, onPrevious, onNext, onToggleShuffle, onToggleRepeat, size }) => (
  <div className="player-controls">
    <button type="button" className={`player-btn ${shuffle ? 'active' : ''}`} onClick={onToggleShuffle} title="Shuffle"><FiShuffle size={size} /></button>
    <button type="button" className="player-btn" onClick={onPrevious} disabled={!currentTrack} title="Previous"><FiSkipBack size={size + 2} /></button>
    <button type="button" className="player-btn player-btn-play" onClick={onPlayPause} disabled={!currentTrack} title={playing ? 'Pause' : 'Play'}>
      {playing ? <FiPause size={size + 4} /> : <FiPlay size={size + 4} />}
    </button>
    <button type="button" className="player-btn" onClick={onNext} disabled={!currentTrack} title="Next"><FiSkipForward size={size + 2} /></button>
    <button type="button" className={`player-btn ${repeat ? 'active' : ''}`} onClick={onToggleRepeat} title="Repeat"><FiRepeat size={size} /></button>
  </div>
);

const PlayerProgress = ({ pct, time, dur, onSeek, fs }) => (
  <div className={fs ? "player-fullscreen-progress" : "player-progress"} role="slider" tabIndex={0}>
    <div className={fs ? "player-fullscreen-progress-track" : "player-progress-track"} onClick={onSeek}>
      <div className={fs ? "player-fullscreen-progress-fill" : "player-progress-fill"} style={{ width: `${pct}%` }} />
      <div className={fs ? "player-fullscreen-progress-thumb" : "player-progress-thumb"} style={{ left: `${pct}%` }} />
    </div>
    {!fs && <><span className="player-time hide-mobile">{formatTime(time)}</span><span className="player-time hide-mobile">{formatTime(dur)}</span></>}
    {fs && <div className="player-fullscreen-time"><span>{formatTime(time)}</span><span>{formatTime(dur)}</span></div>}
  </div>
);

const PlayerVolume = ({ volume, onToggleMute, onChange, className, compact }) => (
  <div className={className}>
    <button type="button" className="player-btn" onClick={onToggleMute} title={volume > 0 ? 'Mute' : 'Unmute'}>
      {volume > 0 ? <FiVolume2 size={compact ? 14 : 18} /> : <FiVolumeX size={compact ? 14 : 18} />}
    </button>
    <input type="range" min="0" max="1" step="0.02" value={volume} onChange={onChange} title={`Volume: ${Math.round(volume * 100)}%`} />
  </div>
);

const Player = () => {
  const audioRef = useRef(null);
  const pollRef = useRef(null);
  const lastTrackIdRef = useRef(null);
  const prevServerRef = useRef(null);
  const prevStateRef = useRef(null);
  const seekTimerRef = useRef(null);
  const seekGuardRef = useRef(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const {
    playing, currentTrack, volume, shuffle, repeat, currentTime, duration,
    activeServer, remoteStatus, queue,
    play, pause, next, previous, setVolume, toggleShuffle, toggleRepeat,
    setCurrentTime, setDuration, seek, setActiveServer, setRemoteStatus,
    removeFromQueue, reorderQueue, clearQueue,
  } = usePlayer();

  const [servers, setServers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    client.get('/servers').then((r) => {
      setServers(user?.is_admin ? [NATIVE_MAIN_SERVER, ...r.data] : r.data);
    }).catch(e => console.error(e));
  }, [user]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    if (activeServer) return;
    const el = audioRef.current;
    if (!el) return;
    if (playing && currentTrack) el.play().catch(() => pause());
    else el.pause();
  }, [playing, currentTrack, pause, activeServer]);

  const handleTimeUpdate = useCallback(() => {
    if (performance.now() < seekGuardRef.current) return;
    setCurrentTime(audioRef.current?.currentTime || 0);
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    setDuration(audioRef.current?.duration || 0);
  }, [setDuration]);

  const handleProgressClick = useCallback((e) => {
    const bar = e.currentTarget;
    if (!bar || !duration) return;
    const frac = (e.clientX - bar.getBoundingClientRect().left) / bar.clientWidth;
    const t = Math.max(0, Math.min(frac * duration, duration));
    seek(t);
    seekGuardRef.current = performance.now() + 500;
    if (audioRef.current) audioRef.current.currentTime = t;
    if (activeServer) {
      setRemoteStatus(prev => prev ? { ...prev, position: t } : { state: 'playing', position: t });
      seekOnServer(activeServer, t).catch(e => console.error(e));
    }
  }, [duration, activeServer, seek, setRemoteStatus]);

  const doSeek = useCallback((delta) => {
    const cur = activeServer ? (remoteStatus?.position || 0) : currentTime;
    const t = Math.max(0, Math.min(cur + delta, duration || 0));
    seek(t);
    seekGuardRef.current = performance.now() + 500;
    if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
    if (activeServer) setRemoteStatus(prev => prev ? { ...prev, position: t } : { state: 'playing', position: t });
    seekTimerRef.current = setTimeout(() => {
      if (audioRef.current) audioRef.current.currentTime = t;
      if (activeServer) seekOnServer(activeServer, t).catch(e => console.error(e));
    }, 300);
  }, [duration, activeServer, currentTime, remoteStatus, seek, setRemoteStatus]);

  const handleEnded = useCallback(() => {
    if (repeat) {
      seek(0);
      if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(e => console.error(e)); }
    } else next();
  }, [repeat, next, seek]);

  const handlePlayPause = useCallback(() => {
    if (playing) {
      pause();
      if (activeServer && currentTrack) pauseOnServer(activeServer).catch(e => console.error(e));
    } else {
      play();
      if (activeServer && currentTrack) {
        if (lastTrackIdRef.current === currentTrack.id) {
          resumeOnServer(activeServer).catch(e => console.error(e));
        } else {
          lastTrackIdRef.current = currentTrack.id;
          playOnServer(activeServer, {
            streamUrl: currentTrack.stream_url,
            title: currentTrack.title,
            artist: currentTrack.artist,
            coverUrl: currentTrack.cover,
          }).catch(e => console.error(e));
        }
      }
    }
  }, [playing, activeServer, currentTrack, pause, play]);

  const toggleMute = useCallback(() => {
    const newVol = volume > 0 ? 0 : 1;
    setVolume(newVol);
    if (activeServer) setVolumeOnServer(activeServer, Math.round(newVol * 100)).catch(e => console.error(e));
  }, [volume, setVolume, activeServer]);

  const handleVolumeChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (activeServer) setVolumeOnServer(activeServer, Math.round(val * 100)).catch(e => console.error(e));
  }, [setVolume, activeServer]);

  const handleServerChange = useCallback((e) => {
    const val = e.target.value;
    if (!val) { if (activeServer) stopOnServer(activeServer).catch(e => console.error(e)); setActiveServer(null); pause(); return; }
    setActiveServer(JSON.parse(val));
  }, [activeServer, setActiveServer, pause]);

  useEffect(() => {
    if (prevServerRef.current && prevServerRef.current !== activeServer) {
      if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
      stopOnServer(prevServerRef.current).catch(e => console.error(e));
      lastTrackIdRef.current = null;
      prevStateRef.current = null;
    }
    prevServerRef.current = activeServer;
  }, [activeServer]);

  useEffect(() => {
    if (!activeServer) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } setRemoteStatus(null); return; }
    if (!playing) { if (currentTrack && lastTrackIdRef.current === currentTrack.id) pauseOnServer(activeServer).catch(e => console.error(e)); return; }
    if (!currentTrack) return;
    if (lastTrackIdRef.current === currentTrack.id) {
      resumeOnServer(activeServer).catch(e => console.error(e));
    } else {
      lastTrackIdRef.current = currentTrack.id;
      playOnServer(activeServer, { streamUrl: currentTrack.stream_url, title: currentTrack.title, artist: currentTrack.artist, coverUrl: currentTrack.cover }).catch(e => console.error(e));
    }
  }, [playing, currentTrack, activeServer, setRemoteStatus]);

  useEffect(() => {
    if (!activeServer || !playing) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } return; }
    const doPoll = async () => {
      try {
        const status = await getServerStatus(activeServer);
        setRemoteStatus(status);
        if (status.position != null) setCurrentTime(status.position);
        if (currentTrack?.duration_seconds) setDuration(currentTrack.duration_seconds);
        if (prevStateRef.current === 'playing' && status.state === 'stopped') { lastTrackIdRef.current = null; next(); }
        prevStateRef.current = status.state;
      } catch (e) { console.error(e) }
    };
    doPoll();
    pollRef.current = setInterval(doPoll, 2000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [activeServer, playing, currentTrack, next, setCurrentTime, setDuration, setRemoteStatus]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
      switch (e.code) {
        case 'Escape': if (fullScreen) setFullScreen(false); break;
        case 'Space': e.preventDefault(); if (currentTrack) { if (playing) pause(); else play(); } break;
        case 'ArrowLeft': e.preventDefault(); if (duration > 0) doSeek(-5); break;
        case 'ArrowRight': e.preventDefault(); if (duration > 0) doSeek(5); break;
        case 'KeyN': if (currentTrack) next(); break;
        case 'KeyP': if (currentTrack) previous(); break;
        case 'KeyM': toggleMute(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playing, currentTrack, duration, doSeek, toggleMute, fullScreen, pause, play, next, previous]);

  const progressPct = activeServer
    ? (remoteStatus?.position != null && duration > 0) ? (remoteStatus.position / duration) * 100 : 0
    : duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTime = activeServer ? (remoteStatus?.position || 0) : currentTime;
  const currentQueueIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;

  return (<>
    <div className="player-wrapper" style={{ position: 'relative' }}>
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
          ) : <div className="player-empty">No track selected</div>}
        </div>

        <div className="player-center">
          <PlayerControls playing={playing} shuffle={shuffle} repeat={repeat} currentTrack={currentTrack}
            onPlayPause={handlePlayPause} onPrevious={previous} onNext={next}
            onToggleShuffle={toggleShuffle} onToggleRepeat={toggleRepeat} size={16} />
          <PlayerProgress pct={progressPct} time={displayTime} dur={duration} onSeek={handleProgressClick} />
        </div>

        <div className="player-right">
          <button type="button" className="player-btn player-queue-toggle" onClick={() => setShowQueue((v) => !v)} disabled={queue.length === 0} title="Queue">
            {queue.length > 0 && <span className="player-queue-indicator" />}
            <FiList size={16} />
          </button>
          <button type="button" className="player-btn" onClick={() => setFullScreen(true)} disabled={!currentTrack} title="Now playing"><FiMaximize2 size={16} /></button>
          {activeServer && (<span className="player-server-badge" title={`Playing on ${activeServer.name}`}><FiServer size={12} /> {activeServer.name}</span>)}
          <PlayerVolume volume={volume} onToggleMute={toggleMute} onChange={handleVolumeChange} className="hide-mobile" />
          <select className="player-server-select" value={activeServer ? JSON.stringify(activeServer) : ''} onChange={handleServerChange} title="Playback target">
            <option value="">Browser</option>
            {servers.map((s) => (<option key={s.id} value={JSON.stringify({ id: s.id, name: s.name, host: s.host, port: s.port })}>{s.name}</option>))}
          </select>
        </div>

        {!activeServer && <audio ref={audioRef} src={currentTrack?.stream_url || ''} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded} />}
      </div>

      {showQueue && (
        <div className="player-queue-panel">
          <div className="player-queue-header">
            <h3>Queue <span>({queue.length} {queue.length === 1 ? 'track' : 'tracks'})</span></h3>
            <button type="button" className="player-queue-clear" onClick={() => { clearQueue(); setShowQueue(false); }}>Clear</button>
          </div>
          {queue.length === 0 ? <div className="player-queue-empty">Queue is empty</div> : (
            <div className="player-queue-list">
              {queue.map((track, i) => (
                <div key={`${track.id}-${i}`} className={`player-queue-item${i === currentQueueIndex ? ' active' : ''}`}>
                  {track.cover ? <img src={track.cover} alt="" className="player-queue-item-cover" /> : <div className="player-queue-item-cover-placeholder" />}
                  <div className="player-queue-item-info">
                    <div className="player-queue-item-title">{track.title}</div>
                    <div className="player-queue-item-artist">{track.artist || 'Unknown Artist'}</div>
                  </div>
                  <div className="player-queue-item-actions">
                    <button type="button" disabled={shuffle || i === 0} onClick={() => reorderQueue(i, i - 1)} title="Move up"><FiChevronUp size={14} /></button>
                    <button type="button" disabled={shuffle || i === queue.length - 1} onClick={() => reorderQueue(i, i + 1)} title="Move down"><FiChevronDown size={14} /></button>
                    <button type="button" onClick={() => removeFromQueue(i)} title="Remove"><FiX size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    {fullScreen && currentTrack && (
      <div className="player-fullscreen" onClick={() => setFullScreen(false)}>
        <div className="player-fullscreen-content" onClick={(e) => e.stopPropagation()}>
          <button className="player-fullscreen-close" onClick={() => setFullScreen(false)}><FiChevronDown size={24} /></button>
          <div className="player-fullscreen-art">
            {currentTrack.cover ? <img src={currentTrack.cover} alt="" /> : <div className="player-fullscreen-art-placeholder" />}
          </div>
          <div className="player-fullscreen-info">
            <h2>{currentTrack.title}</h2>
            <p>{currentTrack.artist || 'Unknown Artist'}</p>
          </div>
          <PlayerProgress pct={progressPct} time={displayTime} dur={duration} fs onSeek={handleProgressClick} />
          <PlayerControls playing={playing} shuffle={shuffle} repeat={repeat} currentTrack={currentTrack}
            onPlayPause={handlePlayPause} onPrevious={previous} onNext={next}
            onToggleShuffle={toggleShuffle} onToggleRepeat={toggleRepeat} size={20} />
          <PlayerVolume volume={volume} onToggleMute={toggleMute} onChange={handleVolumeChange} className="player-fullscreen-volume" compact />
        </div>
      </div>
    )}
  </>);
};

export default Player;