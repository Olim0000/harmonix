/**
 * Servers page (T34) — manage player servers.
 *
 * Header: "Player Servers" + "Add Server" button.
 * List: server cards with name, host:port, status indicator.
 * Main Server (id=0): shown as first item, "This Device (Main Server)", no delete.
 * Status polling: check reachability every 30s.
 * Add/Edit server form (modal).
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchServers,
  createServer,
  updateServer,
  deleteServer,
  fetchServerStatus,
} from '../api/servers';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { ServerIcon, TrashIcon, EditIcon, RefreshIcon } from '../components/icons';
import type { Server } from '../types/api';

export const Servers: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [servers, setServers] = useState<Server[]>([]);
  const [statuses, setStatuses] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [formName, setFormName] = useState('');
  const [formHost, setFormHost] = useState('localhost');
  const [formPort, setFormPort] = useState('3001');
  const [saving, setSaving] = useState(false);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchServers();
      setServers(data);
      // Check statuses for all servers
      data.forEach((srv) => {
        fetchServerStatus(srv.id)
          .then((st) => setStatuses((prev) => ({ ...prev, [srv.id]: st.online })))
          .catch(() => setStatuses((prev) => ({ ...prev, [srv.id]: false })));
      });
    } catch {
      addToast('Failed to load servers', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  // Status polling every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      servers.forEach((srv) => {
        fetchServerStatus(srv.id)
          .then((st) => setStatuses((prev) => ({ ...prev, [srv.id]: st.online })))
          .catch(() => setStatuses((prev) => ({ ...prev, [srv.id]: false })));
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [servers]);

  // ── Modal handlers ────────────────────────────────────────

  const openCreateModal = () => {
    setEditingServer(null);
    setFormName('');
    setFormHost('localhost');
    setFormPort('3001');
    setShowModal(true);
  };

  const openEditModal = (server: Server) => {
    setEditingServer(server);
    setFormName(server.name);
    setFormHost(server.host);
    setFormPort(String(server.port));
    setShowModal(true);
  };

  const handleSave = async () => {
    const port = parseInt(formPort, 10);
    if (!formName.trim() || !formHost.trim() || isNaN(port) || port < 1 || port > 65535) {
      addToast('Please fill in all fields correctly', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingServer) {
        const updated = await updateServer(editingServer.id, {
          name: formName.trim(),
          host: formHost.trim(),
          port,
        });
        setServers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        addToast(`Updated "${updated.name}"`, 'success');
      } else {
        const created = await createServer(formName.trim(), formHost.trim(), port);
        setServers((prev) => [...prev, created]);
        addToast(`Added "${created.name}"`, 'success');
      }
      setShowModal(false);
    } catch {
      addToast(editingServer ? 'Failed to update server' : 'Failed to add server', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (server: Server) => {
    if (!window.confirm(`Delete server "${server.name}"?`)) return;
    try {
      await deleteServer(server.id);
      setServers((prev) => prev.filter((s) => s.id !== server.id));
      addToast(`Deleted "${server.name}"`, 'info');
    } catch {
      addToast('Failed to delete server', 'error');
    }
  };

  const handleRefreshStatus = async (server: Server) => {
    try {
      const st = await fetchServerStatus(server.id);
      setStatuses((prev) => ({ ...prev, [server.id]: st.online }));
      addToast(`${server.name} is ${st.online ? 'online' : 'offline'}`, st.online ? 'success' : 'error');
    } catch {
      setStatuses((prev) => ({ ...prev, [server.id]: false }));
      addToast(`Cannot reach ${server.name}`, 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 className="text-2xl">Player Servers</h1>
        <Button variant="primary" onClick={openCreateModal}>
          Add Server
        </Button>
      </div>

      {servers.length === 0 ? (
        <EmptyState
          icon={<ServerIcon size={48} />}
          title="No servers"
          description="Add a player server to get started."
          action={<Button variant="primary" onClick={openCreateModal}>Add Server</Button>}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Main Server first — admin only */}
          {servers.map((server) => {
            const isMain = server.id === 0;
            if (isMain && !isAdmin) return null;
            const online = statuses[server.id];

            return (
              <div
                key={server.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                {/* Status dot */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 'var(--radius-full)',
                    backgroundColor:
                      online === true
                        ? 'var(--bg-success)'
                        : online === false
                        ? 'var(--bg-danger)'
                        : 'var(--bg-warning)',
                    flexShrink: 0,
                  }}
                  title={online === true ? 'Online' : online === false ? 'Offline' : 'Unknown'}
                />

                {/* Server info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-sm" style={{ fontWeight: 500 }}>
                    {isMain ? 'This Device (Main Server)' : server.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {server.host}:{server.port}
                  </p>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleRefreshStatus(server)}
                  style={actionBtnStyle}
                  title="Refresh status"
                >
                  <RefreshIcon size={14} />
                </button>

                {!isMain && (
                  <>
                    <button
                      onClick={() => openEditModal(server)}
                      style={actionBtnStyle}
                      title="Edit server"
                    >
                      <EditIcon size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(server)}
                      style={{ ...actionBtnStyle, color: 'var(--bg-danger)' }}
                      title="Delete server"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <>
          <div
            onClick={() => setShowModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              zIndex: 200,
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-primary)',
              boxShadow: 'var(--shadow-xl)',
              padding: 'var(--space-6)',
              width: '100%',
              maxWidth: 400,
              zIndex: 210,
            }}
          >
            <h2 className="text-lg" style={{ marginBottom: 'var(--space-4)' }}>
              {editingServer ? 'Edit Server' : 'Add Server'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Name
                </label>
                <Input
                  placeholder="My Server"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Host
                </label>
                <Input
                  placeholder="localhost"
                  value={formHost}
                  onChange={(e) => setFormHost(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Port
                </label>
                <Input
                  placeholder="3001"
                  value={formPort}
                  onChange={(e) => setFormPort(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>
                {editingServer ? 'Save' : 'Add'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

Servers.displayName = 'Servers';

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 'var(--radius-sm)',
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  flexShrink: 0,
};
