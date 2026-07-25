/**
 * useShortcuts (T40) — global keyboard shortcuts.
 *
 * Keys: Space (play/pause), ← (seek -5s), → (seek +5s), N (next), P (previous),
 *       M (mute/unmute), Escape (close fullscreen/queue), F (fullscreen),
 *       Q (queue), / (focus search), L (like/unlike current track — placeholder).
 *
 * Disabled when focus is in input/textarea/select.
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../stores/player';

export function useShortcuts() {
  const navigate = useNavigate();
  // Store previous volume for mute toggle
  const prevVolumeRef = useRef(80);

  const handler = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    const isInput =
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable;

    // Escape always works (even in inputs for overlays)
    if (e.key === 'Escape') {
      const store = usePlayerStore.getState();
      if (store.fullscreen) {
        store.toggleFullscreen();
        return;
      }
      if (store.queueOpen) {
        store.setQueueOpen(false);
        return;
      }
    }

    // "/" focuses search — works everywhere (M2: use navigate, not window.location.href)
    if (e.key === '/') {
      if (!isInput) {
        e.preventDefault();
        navigate('/search');
        // Focus the search input on next frame after navigation
        requestAnimationFrame(() => {
          const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement | null;
          if (searchInput) {
            searchInput.focus();
          }
        });
        return;
      }
    }

    // All other shortcuts are disabled in inputs
    if (isInput) return;

    const store = usePlayerStore.getState();

    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (store.isPlaying) store.pause();
        else store.resume();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        store.seek(Math.max(0, store.position - 5));
        break;
      case 'ArrowRight':
        e.preventDefault();
        store.seek(store.position + 5);
        break;
      case 'n':
      case 'N':
        e.preventDefault();
        store.next();
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        store.prev();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        if (store.volume > 0) {
          prevVolumeRef.current = store.volume;
          store.setVolume(0);
        } else {
          store.setVolume(prevVolumeRef.current || 80);
        }
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        store.toggleFullscreen();
        break;
      case 'q':
      case 'Q':
        e.preventDefault();
        store.toggleQueue();
        break;
      default:
        break;
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
