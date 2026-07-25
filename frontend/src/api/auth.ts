/**
 * Auth API wrappers.
 */
import { api } from './client';
import type { AuthResponse, MeResponse, RefreshResponse, SourceInfo } from '../types/api';

export function register(username: string, password: string): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function me(): Promise<MeResponse> {
  return api<MeResponse>('/me');
}

export function refreshToken(): Promise<RefreshResponse> {
  return api<RefreshResponse>('/auth/refresh', {
    method: 'POST',
  });
}

export function sourceInfo(): Promise<SourceInfo> {
  return api<SourceInfo>('/source/info');
}
