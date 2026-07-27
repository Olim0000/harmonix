/**
 * API client — fetch wrapper with auth auto-attach and 401 handling.
 *
 * Base URL comes from VITE_API_URL env var with a hardcoded fallback.
 * On 401, tries token refresh + retry before logging out.
 */
import { useAuthStore } from '../stores/auth';

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Handle 401 response: refresh token and retry the original request once.
 * Guards against infinite loop on the refresh endpoint itself.
 * Throws ApiError and redirects to /login on failure.
 */
async function handle401(
  path: string,
  init: RequestInit,
  headers: Record<string, string>,
): Promise<Response> {
  // Guard: never retry refresh when the failed request IS the refresh endpoint
  if (path === '/auth/refresh') {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new ApiError(401, { error: 'Session expired' });
  }

  const authStore = useAuthStore.getState();
  try {
    await authStore.refresh();
    const newToken = useAuthStore.getState().token;
    if (!newToken) {
      // Refresh failed — store already logged out
      throw new Error('Refresh failed');
    }

    // Retry original request with fresh token
    const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
    const retryRes = await fetch(`${BASE_URL}${path}`, { ...init, headers: retryHeaders });

    // If retry didn't return 401, pass it back for normal processing
    // (including non-401 errors like 403/404/500 — let the caller handle those)
    if (retryRes.status !== 401) {
      return retryRes;
    }
    // Retry also got 401 — token refresh didn't help, fall through to logout
  } catch {
    // Refresh itself failed (network error, parse error, etc.)
  }

  // All recovery paths exhausted — log out and redirect
  useAuthStore.getState().logout();
  window.location.href = '/login';
  throw new ApiError(401, { error: 'Session expired' });
}

export async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    // handle401 tries refresh + retry; throws on failure
    res = await handle401(path, init, headers);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  // Try to parse JSON; fallback to text for streams/blobs
  const contentType = res.headers.get('content-type') || '';
  let body: unknown;
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body as T;
}

/**
 * Fetch for non-JSON responses (e.g. image blobs, audio streams).
 * Still attaches auth headers.
 */
export async function apiRaw(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    // handle401 tries refresh + retry; throws on failure
    res = await handle401(path, init, headers);
  }

  return res;
}

/** Build cover URL directly (no auth required for covers route). */
export function coverUrl(type: 'artist' | 'album', id: number): string {
  return `${BASE_URL}/covers/${type}/${id}`;
}
