/**
 * FullscreenOverlay (T37) — full viewport now-playing overlay.
 * Blurred album art background, large art center, controls, progress, volume.
 * Close: X button top-right OR Escape key. Mobile: swipe down.
 * Animation: 300ms fade on open, reverse on close via state-driven CSS transition.
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { usePlayerStore } from '../stores/player';
import { coverUrl } from '../api/client';
import { formatDuration } from '../utils/format';
import {
  PlayIcon,
  PauseIcon,
  SkipNextIcon,
  SkipPrevIcon,
  ShuffleIcon,
  RepeatIcon,
} from './icons';
import { ServerSelector } from './ServerSelector';

// Inline icons not in the shared set
const MinimizeIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 3H3v4" />
    <path d="M13 17h4v-4" />
    <path d="M17 7l-5 5" />
    <path d="M3 13l5-5" />
  </svg>
);

const QueueIconSmall: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5h14" />
    <path d="M3 10h14" />
    <path d="M3 15h10" />
  </svg>
);

export const FullscreenOverlay: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    shuffle,
    repeat,
    fullscreen,
    toggleFullscreen,
    pause,
    resume,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    next,
    prev,
    toggleQueue,
  } = usePlayerStore();

  const progressRef = useRef<HTMLDivElement>(null);

  // Animation state (H5): we always render when `fullscreen` is true, but
  // use `mounted` for initial render and `visible` for the fade transition.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Mount / unmount with animation
  useEffect(() => {
    if (fullscreen) {
      setMounted(true);
      // Trigger fade-in on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else if (mounted) {
      // Start fade-out
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [fullscreen, mounted]);

  // Close on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen, toggleFullscreen]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seek(pct * duration);
    },
    [duration, seek]
  );

  // Swipe down to close (mobile — H6)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeDeltaY, setSwipeDeltaY] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setSwipeDeltaY(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    // Only track downward swipes
    if (deltaY > 0) {
      setSwipeDeltaY(deltaY);
    }
  }, []);

  const handleTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      if (swipeDeltaY > 80) {
        toggleFullscreen();
      }
      setSwipeDeltaY(0);
      touchStartRef.current = null;
    },
    [swipeDeltaY, toggleFullscreen]
  );

  // Don't render at all when not mounted
  if (!mounted) return null;

  const artSrc = currentTrack?.album_id
    ? coverUrl('album', currentTrack.album_id)
    : undefined;

  // Swipe-down visual offset (capped at 200px)
  const swipeOffset = Math.min(swipeDeltaY, 200);
  const swipeOpacity = 1 - (swipeOffset / 200) * 0.5;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: `translateY(${swipeOffset}px) scale(${visible ? 1 : 0.95})`,
        transition: 'opacity 0.3s var(--easing-default), transform 0.3s var(--easing-default)',
      }}
    >
      {/* Blurred background */}
      {artSrc && (
        <div
          style={{
            position: 'absolute',
            inset: -50,
            backgroundImage: `url(${artSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(50px) brightness(0.3)',
            transform: 'scale(1.2)',
            opacity: swipeOpacity,
          }}
        />
      )}

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          opacity: swipeOpacity,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: 600,
          padding: 'var(--space-6)',
          gap: 'var(--space-6)',
          opacity: swipeOpacity,
        }}
      >
        {/* Close button */}
        <button
          onClick={toggleFullscreen}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
          aria-label="Close fullscreen"
        >
          <svg width={18} height={18} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>

        {/* Album art */}
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-tertiary)',
            boxShadow: 'var(--shadow-xl)',
            flexShrink: 0,
          }}
          className="fullscreen-art"
        >
          {artSrc ? (
            <img
              src={artSrc}
              alt={currentTrack?.title || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-tertiary)',
              }}
            >
              <svg width={64} height={64} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1}>
                <circle cx="10" cy="10" r="8" />
                <circle cx="10" cy="10" r="3" />
              </svg>
            </div>
          )}
        </div>

        {/* Track info */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <p
            className="text-2xl"
            style={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--text-primary)',
            }}
          >
            {currentTrack?.title || 'No track playing'}
          </p>
          <p
            className="text-lg"
            style={{
              color: 'var(--text-secondary)',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentTrack?.artist_name || ''}
          </p>
        </div>

        {/* Progress bar — large draggable handle */}
        <div style={{ width: '100%' }}>
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            style={{
              width: '100%',
              height: 6,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 3,
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
                backgroundColor: 'var(--text-primary)',
                borderRadius: 3,
                transition: 'width 0.2s linear',
              }}
            />
            {/* Large draggable handle */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: duration ? `${(position / duration) * 100}%` : '0%',
                transform: 'translate(-50%, -50%)',
                width: 14,
                height: 14,
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--text-primary)',
                boxShadow: 'var(--shadow-sm)',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
            }}
          >
            <span className="text-xs" style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(position)}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(duration)}
            </span>
          </div>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={toggleShuffle}
            style={{
              ...fsIconBtn,
              color: shuffle ? 'var(--bg-accent)' : 'var(--text-secondary)',
            }}
            aria-label="Shuffle"
          >
            <ShuffleIcon size={22} />
          </button>
          <button onClick={prev} style={fsIconBtn} aria-label="Previous">
            <SkipPrevIcon size={26} />
          </button>
          <button
            onClick={() => (isPlaying ? pause() : resume())}
            style={{
              ...fsIconBtn,
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--text-primary)',
              color: 'var(--bg-primary)',
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
          </button>
          <button onClick={next} style={fsIconBtn} aria-label="Next">
            <SkipNextIcon size={26} />
          </button>
          <button
            onClick={cycleRepeat}
            style={{
              ...fsIconBtn,
              color: repeat !== 'none' ? 'var(--bg-accent)' : 'var(--text-secondary)',
              position: 'relative',
            }}
            aria-label={`Repeat: ${repeat}`}
          >
            <RepeatIcon size={22} />
            {repeat === 'repeat-one' && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  fontSize: 10,
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

        {/* Volume (desktop only) */}
        <div className="fs-volume-desktop" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 300 }}>
          <svg width={18} height={18} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 7h3l4-4v14L5 13H2V7z" />
            <path d="M14 6a5 5 0 010 8" />
            <path d="M16 3a9 9 0 010 14" />
          </svg>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--text-primary)', cursor: 'pointer' }}
            aria-label="Volume"
          />
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ServerSelector compact />
          <button onClick={toggleQueue} style={fsIconBtn} aria-label="Queue">
            <QueueIconSmall size={18} />
          </button>
          <button onClick={toggleFullscreen} style={fsIconBtn} aria-label="Minimize">
            <MinimizeIcon size={18} />
          </button>
        </div>
      </div>

      {/* Mobile overrides */}
      <style>{`
        @media (max-width: 767px) {
          .fullscreen-art { width: 200px !important; height: 200px !important; }
          .fs-volume-desktop { display: none !important; }
        }
      `}</style>
    </div>
  );
};

FullscreenOverlay.displayName = 'FullscreenOverlay';

const fsIconBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  borderRadius: 'var(--radius-full)',
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  transition: 'color var(--duration-fast) var(--easing-default)',
};
