import create from 'zustand';

export const usePlayerStore = create((set) => ({
  playing: false,
  currentTrack: null,
  queue: [],
  setQueue: (queue) => set({ queue }),
  play: (track) => set((state) => ({
    playing: true,
    currentTrack: track || state.currentTrack,
  })),
  pause: () => set({ playing: false }),
  next: () => set((state) => {
    if (!state.currentTrack || state.queue.length === 0) return state;
    const currentIndex = state.queue.findIndex((track) => track.id === state.currentTrack.id);
    const nextTrack = state.queue[(currentIndex + 1) % state.queue.length];
    return { currentTrack: nextTrack, playing: true };
  }),
  previous: () => set((state) => {
    if (!state.currentTrack || state.queue.length === 0) return state;
    const currentIndex = state.queue.findIndex((track) => track.id === state.currentTrack.id);
    const previousIndex = currentIndex <= 0 ? state.queue.length - 1 : currentIndex - 1;
    return { currentTrack: state.queue[previousIndex], playing: true };
  }),
}));
