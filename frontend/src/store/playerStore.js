import create from 'zustand';

export const usePlayerStore = create((set, get) => ({
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

  setQueue: (queue) => set({ queue }),

  play: (track) => set((state) => ({
    playing: true,
    currentTrack: track || state.currentTrack,
  })),

  pause: () => set({ playing: false }),

  setVolume: (volume) => set({ volume }),

  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  toggleRepeat: () => set((state) => ({ repeat: !state.repeat })),

  setCurrentTime: (currentTime) => set({ currentTime }),

  setDuration: (duration) => set({ duration }),

  seek: (time) => { set({ currentTime: time }); },

  setActiveServer: (server) => set({ activeServer: server, remoteStatus: null }),

  setRemoteStatus: (status) => set({ remoteStatus: status }),

  next: () => set((state) => {
    if (!state.currentTrack || state.queue.length === 0) return state;
    const currentIndex = state.queue.findIndex((track) => track.id === state.currentTrack.id);
    let nextIndex;
    if (state.shuffle) {
      nextIndex = Math.floor(Math.random() * state.queue.length);
    } else {
      nextIndex = (currentIndex + 1) % state.queue.length;
    }
    return { currentTrack: state.queue[nextIndex], playing: true };
  }),

  previous: () => set((state) => {
    if (!state.currentTrack || state.queue.length === 0) return state;
    const currentIndex = state.queue.findIndex((track) => track.id === state.currentTrack.id);
    const prevIndex = currentIndex <= 0 ? state.queue.length - 1 : currentIndex - 1;
    return { currentTrack: state.queue[prevIndex], playing: true };
  }),
}));
