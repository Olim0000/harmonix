/**
 * Servers API wrappers (T34).
 */
import { api } from './client';
import type { Server, ServerStatus } from '../types/api';

// ─── List ────────────────────────────────────────────────

export function fetchServers(): Promise<Server[]> {
  return api<{ servers: Server[] }>('/servers').then((r) => r.servers);
}

// ─── Create ──────────────────────────────────────────────

export function createServer(
  name: string,
  host: string,
  port: number
): Promise<Server> {
  return api<{ server: Server }>('/servers', {
    method: 'POST',
    body: JSON.stringify({ name, host, port }),
  }).then((r) => r.server);
}

// ─── Update ──────────────────────────────────────────────

export function updateServer(
  id: number,
  data: { name?: string; host?: string; port?: number }
): Promise<Server> {
  return api<{ server: Server }>(`/servers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then((r) => r.server);
}

// ─── Delete ──────────────────────────────────────────────

export function deleteServer(id: number): Promise<void> {
  return api<void>(`/servers/${id}`, { method: 'DELETE' });
}

// ─── Status ──────────────────────────────────────────────

export function fetchServerStatus(id: number): Promise<ServerStatus> {
  return api<ServerStatus>(`/servers/${id}/status`);
}
