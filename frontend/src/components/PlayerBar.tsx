/**
 * PlayerBar (T35) — persistent bottom bar for playback controls.
 *
 * Desktop (72px): play/pause, prev, next | art + title + artist | server selector | volume | queue, fullscreen | progress
 * Mobile (64px): play/pause, prev, next | art + title | queue, fullscreen | progress
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { usePlayerStore } from '../stores/player';
import { coverUrl } from '../api/client';
import { ServerSelector } from './ServerSelector';
import { formatDuration } from '../utils/format';
import {
  PlayIcon,
  PauseIcon,
  SkipNextIcon,
  SkipPrevIcon,
  ShuffleIcon,
  RepeatIcon,
  VolumeHighIcon,
} from './icons';
import type { RepeatMode } from '../types/api';

// Need a queue icon and fullscreen icon — adding them inline
const QueueIconComponent: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h14" />
    <path d="M3 10h14" />
    <path d="M3 15h10" />
  </svg>
);

const FullscreenIconComponent: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V3h4" />
    <path d="M13 3h4v4" />
    <path d="M17 13v4h-4" />
    <path d="M7 17H3v-4" />
  </svg>
);

export const PlayerBar: React.FC = () => {
  // Individual selectors — avoids re-render on every poll
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const position = usePlayerStore(s => s.position);
  const duration = usePlayerStore(s => s.duration);
  const volume = usePlayerStore(s => s.volume);
  const shuffle = usePlayerStore(s => s.shuffle);
  const repeat = usePlayerStore(s => s.repeat);
  // Methods — stable references, one selector each
  const pause = usePlayerStore(s => s.pause);
  const resume = usePlayerStore(s => s.resume);
  const seek = usePlayerStore(s => s.seek);
  const setVolume = usePlayerStore(s => s.setVolume);
  const toggleShuffle = usePlayerStore(s => s.toggleShuffle);
  const cycleRepeat = usePlayerStore(s => s.cycleRepeat);
  const next = usePlayerStore(s => s.next);
  const prev = usePlayerStore(s => s.prev);
  const startPolling = usePlayerStore(s => s.startPolling);
  const stopPolling = usePlayerStore(s => s.stopPolling);
  const toggleFullscreen = usePlayerStore(s => s.toggleFullscreen);
  const toggleQueue = usePlayerStore(s => s.toggleQueue);

  const progressRef = useRef<HTMLDivElement>(null);
  const lastSeekRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Start polling on mount
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pause();
    else resume();
  }, [isPlaying, pause, resume]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seek(pct * duration);
    },
    [duration, seek]
  );

  const doSeek = useCallback(
    (clientX: number) => {
      if (!progressRef.current || !duration) return;
      const now = Date.now();
      if (now - lastSeekRef.current < 100) return;
      lastSeekRef.current = now;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seek(pct * duration);
    },
    [duration, seek]
  );

  const handleProgressDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      doSeek(e.clientX);
    },
    [isDragging, doSeek]
  );

  const handleProgressDragTouch = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      doSeek(e.touches[0].clientX);
    },
    [isDragging, doSeek]
  );

  // If no track loaded, render minimal bar
  const hasTrack = currentTrack != null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--playerbar-height)',
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 90,
      }}
    >
      {/* Main bar content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 12,
          minWidth: 0,
        }}
      >
        {/* Left: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={prev}
            style={iconBtnStyle}
            aria-label="Previous"
            title="Previous (P)"
          >
            <SkipPrevIcon size={18} />
          </button>
          <button
            onClick={handlePlayPause}
            style={{
              ...iconBtnStyle,
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </button>
          <button
            onClick={next}
            style={iconBtnStyle}
            aria-label="Next"
            title="Next (N)"
          >
            <SkipNextIcon size={18} />
          </button>
        </div>

        {/* Center: Track info */}
        {hasTrack && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: '0 1 300px',
              minWidth: 0,
            }}
          >
            {currentTrack.album_id > 0 && (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-tertiary)',
                  flexShrink: 0,
                }}
              >
                <img
                  src={coverUrl('album', currentTrack.album_id)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <p
                className="text-sm"
                style={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentTrack.title}
              </p>
              <p
                className="text-xs"
                style={{
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentTrack.artist_name || 'Unknown Artist'}
              </p>
            </div>
          </div>
        )}

        {!hasTrack && (
          <div style={{ flex: '0 1 300px', minWidth: 0 }}>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              No track playing
            </p>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Right: Server selector (desktop) */}
        <div className="playerbar-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ServerSelector compact />
        </div>

        {/* Shuffle / Repeat (desktop) */}
        <div className="playerbar-desktop" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={toggleShuffle}
            style={{
              ...iconBtnStyle,
              color: shuffle ? 'var(--bg-accent)' : 'var(--text-secondary)',
            }}
            aria-label="Shuffle"
            title="Shuffle"
          >
            <ShuffleIcon size={16} />
          </button>
          <button
            onClick={cycleRepeat}
            style={{
              ...iconBtnStyle,
              color: repeat !== 'none' ? 'var(--bg-accent)' : 'var(--text-secondary)',
              position: 'relative',
            }}
            aria-label={`Repeat: ${repeat}`}
            title={`Repeat: ${repeat}`}
          >
            <RepeatIcon size={16} />
            {repeat === 'repeat-one' && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'var(--bg-accent)',
                  lineHeight: 1,
                }}
              >
                1
              </span>
            )}
          </button>
        </div>

        {/* Volume (desktop) */}
        <div className="playerbar-desktop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <VolumeHighIcon size={16} />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{
              width: 80,
              accentColor: 'var(--bg-accent)',
              cursor: 'pointer',
            }}
            aria-label="Volume"
          />
        </div>

        {/* Queue / Fullscreen buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={toggleQueue}
            style={iconBtnStyle}
            aria-label="Queue"
            title="Queue (Q)"
          >
            <QueueIconComponent size={18} />
          </button>
          <button
            onClick={toggleFullscreen}
            style={iconBtnStyle}
            aria-label="Fullscreen"
            title="Fullscreen (F)"
          >
            <FullscreenIconComponent size={18} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseMove={handleProgressDrag}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={() => setIsDragging(true)}
        onTouchMove={handleProgressDragTouch}
        onTouchEnd={() => setIsDragging(false)}
        onTouchCancel={() => setIsDragging(false)}
        style={{
          height: 4,
          backgroundColor: 'var(--bg-tertiary)',
          cursor: 'pointer',
          position: 'relative',
        }}
        role="slider"
        aria-label="Progress"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
      >
        <div
          style={{
            height: '100%',
            width: duration ? `${(position / duration) * 100}%` : '0%',
            backgroundColor: 'var(--bg-accent)',
            borderRadius: '0 2px 2px 0',
            transition: isDragging ? 'none' : 'width 0.2s linear',
          }}
        />
      </div>

      {/* Mobile responsive overrides */}
      <style>{`
        @media (max-width: 767px) {
          .playerbar-desktop { display: none !important; }
        }
      `}</style>
    </div>
  );
};

PlayerBar.displayName = 'PlayerBar';

// Shared icon button style
const iconBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 'var(--radius-sm)',
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'color var(--duration-fast) var(--easing-default)',
};
