/**
 * API client — fetch wrapper with auth auto-attach and 401 handling.
 *
 * Base URL is hardcoded to backend (no Vite proxy per locked decision).
 */
import { useAuthStore } from '../stores/auth';

export const BASE_URL = 'http://localhost:3001/api';

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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new ApiError(401, { error: 'Session expired' });
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

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new ApiError(401, { error: 'Session expired' });
  }

  return res;
}

/** Build cover URL directly (no auth required for covers route). */
export function coverUrl(type: 'artist' | 'album', id: number): string {
  return `${BASE_URL}/covers/${type}/${id}`;
}
