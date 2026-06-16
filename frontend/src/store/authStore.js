import create from 'zustand';

function decodeToken(token) {
  if (!token) return {};
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

export const useAuthStore = create((set) => {
  const token = localStorage.getItem('token');
  const payload = decodeToken(token);
  return {
    user: payload.username ? { id: payload.id, username: payload.username, is_admin: !!payload.is_admin } : null,
    token,
    login: (user, token) => {
      set({ user, token });
      localStorage.setItem('token', token);
      if (user?.username) {
        localStorage.setItem('username', user.username);
        localStorage.setItem('is_admin', user.is_admin ? '1' : '0');
      }
    },
    logout: () => {
      set({ user: null, token: null });
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('is_admin');
    },
  };
});
