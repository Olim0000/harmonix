import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

function decodeToken(token) {
  if (!token) return {};
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

function initUser() {
  const storedToken = localStorage.getItem('token');
  const payload = decodeToken(storedToken);
  return payload.username ? { id: payload.id, username: payload.username, is_admin: !!payload.is_admin } : null;
}

function initToken() {
  const storedToken = localStorage.getItem('token');
  const payload = decodeToken(storedToken);
  return payload.username ? storedToken : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(initUser);
  const [token, setToken] = useState(initToken);

  const login = (userData, token) => {
    setUser(userData);
    setToken(token);
    localStorage.setItem('token', token);
    if (userData?.username) {
      localStorage.setItem('username', userData.username);
      localStorage.setItem('is_admin', userData.is_admin ? '1' : '0');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('is_admin');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}