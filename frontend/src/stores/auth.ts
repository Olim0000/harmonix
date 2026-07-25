/**
 * Auth store — Zustand with manual localStorage persistence.
 *
 * Persisted keys: 'token', 'username' (per DESIGN.md §5.4).
 */
import { create } from 'zustand';
import type { User } from '../types/api';
import * as authApi from '../api/auth';

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;

  /** Login — calls API, on success sets token+user, persists to localStorage. Returns user. */
  login: (username: string, password: string) => Promise<User>;

  /** Register — calls API, on success sets token+user, persists to localStorage. Returns user. */
  register: (username: string, password: string) => Promise<User>;

  /** Logout — clears state + localStorage. */
  logout: () => void;

  /** Refresh — calls /api/auth/refresh, updates token in state + localStorage. */
  refresh: () => Promise<void>;

  /** Hydrate from localStorage on app init. */
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  loading: false,

  login: async (username: string, password: string) => {
    set({ loading: true });
    try {
      const res = await authApi.login(username, password);
      set({ token: res.token, user: res.user, loading: false });
      localStorage.setItem('token', res.token);
      localStorage.setItem('username', res.user.username);
      return res.user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  register: async (username: string, password: string) => {
    set({ loading: true });
    try {
      const res = await authApi.register(username, password);
      set({ token: res.token, user: res.user, loading: false });
      localStorage.setItem('token', res.token);
      localStorage.setItem('username', res.user.username);
      return res.user;
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: () => {
    set({ token: null, user: null });
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  },

  refresh: async () => {
    try {
      const res = await authApi.refreshToken();
      set({ token: res.token });
      localStorage.setItem('token', res.token);
    } catch {
      // If refresh fails (e.g., user deleted), logout
      get().logout();
    }
  },

  hydrate: () => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (token && username) {
      set({ token, user: { id: 0, username, role: 'user', created_at: '' } });
      // Try to get fresh user info
      authApi.me().then((res) => {
        set({ user: res.user });
      }).catch(() => {
        // If /me fails, token might be stale — try refresh
        get().refresh();
      });
    }
  },
}));
