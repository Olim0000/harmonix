/**
 * Auth store tests.
 *
 * Tests:
 * - login happy path sets token + user in store
 * - login failure (401) does NOT set token
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../stores/auth';

const API_BASE = 'http://localhost:3001/api';

describe('auth store', () => {
  beforeEach(() => {
    // Reset store
    useAuthStore.setState({ token: null, user: null, loading: false });
    localStorage.clear();
  });

  it('login sets token and user on success', async () => {
    const mockUser = { id: 1, username: 'testuser', role: 'user' as const, created_at: '2024-01-01' };
    const mockToken = 'test.jwt.token';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ token: mockToken, user: mockUser }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const user = await useAuthStore.getState().login('testuser', 'password123');

    expect(user).toEqual(mockUser);
    const state = useAuthStore.getState();
    expect(state.token).toBe(mockToken);
    expect(state.user).toEqual(mockUser);
    expect(localStorage.getItem('token')).toBe(mockToken);
    expect(localStorage.getItem('username')).toBe('testuser');
  });

  it('login failure does NOT set token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      useAuthStore.getState().login('testuser', 'wrongpassword')
    ).rejects.toThrow();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
