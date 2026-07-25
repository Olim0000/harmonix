/**
 * API client tests.
 *
 * Tests:
 * - 401 response triggers logout and redirect to /login
 * - Successful request returns parsed JSON
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/auth';

describe('API client', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'existing-token', user: null, loading: false });
    localStorage.setItem('token', 'existing-token');
    window.location.href = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('401 response calls logout and redirects to /login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(api('/test')).rejects.toThrow('API error 401');

    // Auth state should be cleared
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('successful request returns parsed JSON', async () => {
    const mockData = { id: 1, name: 'Test' };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await api('/test');
    expect(result).toEqual(mockData);
  });
});
