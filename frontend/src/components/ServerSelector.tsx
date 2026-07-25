/**
 * ServerSelector — dropdown for choosing playback server.
 * Used in PlayerBar and FullscreenOverlay.
 * Shows status indicators, current server highlighted with checkmark.
 */
import React, { useEffect, useState, useRef } from 'react';
import { usePlayerStore } from '../stores/player';
import { useUIStore } from '../stores/ui';
import { fetchServers, fetchServerStatus } from '../api/servers';
import { ChevronDownIcon, CheckIcon } from './icons';
import type { Server } from '../types/api';

interface ServerSelectorProps {
  compact?: boolean;
}

export const ServerSelector: React.FC<ServerSelectorProps> = ({ compact = false }) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [statuses, setStatuses] = useState<Record<number, 'online' | 'offline' | 'unknown'>>({});
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const addToast = useUIStore((s) => s.addToast);
  const { currentServerId, playTrack, currentTrack } = usePlayerStore();

  useEffect(() => {
    fetchServers()
      .then((s) => {
        setServers(s);
        // Initialize all to unknown, then probe each (M3)
        const initial: Record<number, 'online' | 'offline' | 'unknown'> = {};
        s.forEach((srv) => { initial[srv.id] = 'unknown'; });
        setStatuses(initial);
        s.forEach((srv) => {
          fetchServerStatus(srv.id)
            .then((st) => setStatuses((prev) => ({ ...prev, [srv.id]: st.online ? 'online' : 'offline' })))
            .catch(() => setStatuses((prev) => ({ ...prev, [srv.id]: 'offline' })));
        });
      })
      .catch(() => { /* servers may not be available */ });
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = async (server: Server) => {
    setOpen(false);
    if (server.id === currentServerId) return;

    try {
      const status = await fetchServerStatus(server.id);
      if (!status.online) {
        addToast(`Cannot reach ${server.name}. Is it running?`, 'error');
        return;
      }
    } catch {
      addToast(`Cannot reach ${server.name}. Is it running?`, 'error');
      return;
    }

    // Switch server — replay current track on new server
    if (currentTrack) {
      try {
        await playTrack(currentTrack.id, server.id);
        addToast(`Switched playback to ${server.name}`, 'success');
      } catch {
        addToast(`Failed to switch to ${server.name}`, 'error');
      }
    }
  };

  const currentName = servers.find((s) => s.id === currentServerId)?.name || 'Main Server';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: compact ? '4px 8px' : '6px 12px',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          fontSize: compact ? 11 : 12,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          maxWidth: compact ? 120 : 180,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        aria-label="Select server"
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 'var(--radius-full)',
            backgroundColor:
              statuses[currentServerId] === 'online'
                ? 'var(--bg-success)'
                : statuses[currentServerId] === 'offline'
                ? 'var(--bg-danger)'
                : 'var(--bg-warning)',
            flexShrink: 0,
          }}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentName}</span>
        <ChevronDownIcon size={12} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: 200,
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border-primary)',
            }}
          >
            Player Servers
          </div>
          {servers.map((server) => (
            <button
              key={server.id}
              onClick={() => handleSelect(server)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '10px 12px',
                backgroundColor:
                  server.id === currentServerId
                    ? 'rgba(37, 99, 235, 0.1)'
                    : 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (server.id !== currentServerId)
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                if (server.id !== currentServerId)
                  e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 'var(--radius-full)',
                  backgroundColor:
                    statuses[server.id] === 'online'
                      ? 'var(--bg-success)'
                      : statuses[server.id] === 'offline'
                      ? 'var(--bg-danger)'
                      : 'var(--bg-warning)',
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {server.name}
              </span>
              {server.id === currentServerId && <CheckIcon size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

ServerSelector.displayName = 'ServerSelector';
