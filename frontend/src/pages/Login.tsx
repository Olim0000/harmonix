/**
 * Login page (T23) — per DESIGN.md §4.1.
 * Centered card, form username+password, inline error, toast for network error.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const addToast = useUIStore((s) => s.addToast);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }

    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err: unknown) {
      const apiErr = err as { status?: number; body?: { error?: string } };
      if (apiErr.status && apiErr.body?.error) {
        setError(apiErr.body.error);
      } else {
        addToast('Network error. Please try again.', 'error');
      }
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <h1 className="text-xl" style={{ textAlign: 'center', marginBottom: 4 }}>
          Harmonix
        </h1>
        <p
          className="text-sm"
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-6)',
          }}
        >
          Sign in to Harmonix
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              Username
            </label>
            <Input
              variant="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              Password
            </label>
            <Input
              variant="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--bg-danger)', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={loading} style={{ width: '100%' }}>
            Sign in
          </Button>
        </form>

        <p
          className="text-sm"
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            marginTop: 'var(--space-4)',
          }}
        >
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: 'var(--bg-accent)' }}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

Login.displayName = 'Login';
