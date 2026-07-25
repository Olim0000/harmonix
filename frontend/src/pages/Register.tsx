/**
 * Register page (T24) — per DESIGN.md §4.2.
 * Centered card, form username+password+confirm, inline error, toast for network error.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const addToast = useUIStore((s) => s.addToast);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const validate = (): boolean => {
    if (!username.trim() || !password || !confirm) {
      setError('All fields are required');
      return false;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    try {
      await register(username.trim(), password);
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
          Create your account
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              Username
            </label>
            <Input
              variant="text"
              placeholder="Choose a username"
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
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              Confirm Password
            </label>
            <Input
              variant="password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--bg-danger)', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" loading={loading} style={{ width: '100%' }}>
            Create account
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
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--bg-accent)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

Register.displayName = 'Register';
