import create from 'zustand';

export const useAuthStore = create((set) => ({
  user: localStorage.getItem('username') ? { username: localStorage.getItem('username') } : null,
  token: localStorage.getItem('token'),
  login: (user, token) => {
    set({ user, token });
    localStorage.setItem('token', token);
    if (user?.username) localStorage.setItem('username', user.username);
  },
  logout: () => {
    set({ user: null, token: null });
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  },
}));
