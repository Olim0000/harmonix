import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

const PlayerContext = createContext(null);

const initialState = {
  playing: false,
  currentTrack: null,
  queue: [],
  volume: 1,
  shuffle: false,
  repeat: false,
  currentTime: 0,
  duration: 0,
  activeServer: null,
  remoteStatus: null,
};

function playerReducer(state, action) {
  switch (action.type) {
    case 'SET_QUEUE':
      return { ...state, queue: action.payload };
    case 'ADD_TO_QUEUE': {
      if (state.queue.some(t => t.id === action.payload.id)) return state;
      return { ...state, queue: [...state.queue, action.payload] };
    }
    case 'REMOVE_FROM_QUEUE': {
      const queue = [...state.queue];
      queue.splice(action.payload, 1);
      return { ...state, queue };
    }
    case 'REORDER_QUEUE': {
      const queue = [...state.queue];
      const [moved] = queue.splice(action.payload.from, 1);
      queue.splice(action.payload.to, 0, moved);
      return { ...state, queue };
    }
    case 'CLEAR_QUEUE':
      return { ...state, queue: [] };
    case 'PLAY_NEXT': {
      if (!state.currentTrack) return { ...state, queue: [action.payload] };
      const currentIndex = state.queue.findIndex(t => t.id === state.currentTrack.id);
      const queue = [...state.queue];
      if (currentIndex === -1) queue.splice(0, 0, action.payload);
      else queue.splice(currentIndex + 1, 0, action.payload);
      return { ...state, queue };
    }
    case 'PLAY':
      return { ...state, playing: true, currentTrack: action.payload ?? state.currentTrack };
    case 'PAUSE':
      return { ...state, playing: false };
    case 'SET_VOLUME':
      return { ...state, volume: action.payload };
    case 'TOGGLE_SHUFFLE':
      return { ...state, shuffle: !state.shuffle };
    case 'TOGGLE_REPEAT':
      return { ...state, repeat: !state.repeat };
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: action.payload };
    case 'SET_DURATION':
      return { ...state, duration: action.payload };
    case 'SEEK':
      return { ...state, currentTime: action.payload };
    case 'SET_ACTIVE_SERVER':
      return { ...state, activeServer: action.payload, remoteStatus: null };
    case 'SET_REMOTE_STATUS':
      return { ...state, remoteStatus: action.payload };
    case 'NEXT': {
      if (!state.currentTrack || state.queue.length === 0) return state;
      const currentIndex = state.queue.findIndex(t => t.id === state.currentTrack.id);
      let nextIndex;
      if (state.shuffle) {
        if (state.queue.length > 1) {
          do { nextIndex = Math.floor(Math.random() * state.queue.length); }
          while (nextIndex === currentIndex);
        } else nextIndex = currentIndex;
      } else {
        nextIndex = (currentIndex + 1) % state.queue.length;
      }
      return { ...state, currentTrack: state.queue[nextIndex], playing: true };
    }
    case 'PREVIOUS': {
      if (!state.currentTrack || state.queue.length === 0) return state;
      const currentIndex = state.queue.findIndex(t => t.id === state.currentTrack.id);
      const prevIndex = currentIndex <= 0 ? state.queue.length - 1 : currentIndex - 1;
      return { ...state, currentTrack: state.queue[prevIndex], playing: true };
    }
    default:
      return state;
  }
}

function loadSaved() {
  try {
    const saved = localStorage.getItem('harmonix_player');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

export function PlayerProvider({ children }) {
  const [state, dispatch] = useReducer(playerReducer, initialState, (initial) => {
    const saved = loadSaved();
    // ponytail: discard ephemeral fields — no autoplay, no stale position
    return saved ? { ...initial, ...saved, playing: false, currentTime: 0, duration: 0, remoteStatus: null } : initial;
  });

  useEffect(() => {
    // ponytail: no debounce, localStorage sync is fast enough for a personal music app
    const { currentTime, duration, remoteStatus, playing, ...persist } = state;
    localStorage.setItem('harmonix_player', JSON.stringify(persist));
  }, [state]);

  const actions = useMemo(() => ({
    setQueue: (queue) => dispatch({ type: 'SET_QUEUE', payload: queue }),
    addToQueue: (track) => dispatch({ type: 'ADD_TO_QUEUE', payload: track }),
    removeFromQueue: (index) => dispatch({ type: 'REMOVE_FROM_QUEUE', payload: index }),
    reorderQueue: (from, to) => dispatch({ type: 'REORDER_QUEUE', payload: { from, to } }),
    clearQueue: () => dispatch({ type: 'CLEAR_QUEUE' }),
    playNext: (track) => dispatch({ type: 'PLAY_NEXT', payload: track }),
    play: (track) => dispatch({ type: 'PLAY', payload: track }),
    pause: () => dispatch({ type: 'PAUSE' }),
    setVolume: (volume) => dispatch({ type: 'SET_VOLUME', payload: volume }),
    toggleShuffle: () => dispatch({ type: 'TOGGLE_SHUFFLE' }),
    toggleRepeat: () => dispatch({ type: 'TOGGLE_REPEAT' }),
    setCurrentTime: (time) => dispatch({ type: 'SET_CURRENT_TIME', payload: time }),
    setDuration: (dur) => dispatch({ type: 'SET_DURATION', payload: dur }),
    seek: (time) => dispatch({ type: 'SEEK', payload: time }),
    setActiveServer: (server) => dispatch({ type: 'SET_ACTIVE_SERVER', payload: server }),
    setRemoteStatus: (status) => dispatch({ type: 'SET_REMOTE_STATUS', payload: status }),
    next: () => dispatch({ type: 'NEXT' }),
    previous: () => dispatch({ type: 'PREVIOUS' }),
  }), []);

  return (
    <PlayerContext.Provider value={{ state, actions }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return { ...ctx.state, ...ctx.actions };
}