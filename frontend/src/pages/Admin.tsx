/**
 * Admin page (T14) — Users/Scan/Enrich tabs.
 *
 * Users tab: lists users (admin only).
 * Scan tab: trigger library scan with SSE progress.
 * Enrich tab: shows "Phase 2 — coming soon".
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs } from '../components/ui/Tab';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useUIStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { api, apiRaw } from '../api/client';
import type { AdminUser, ScanProgress } from '../types/api';

type TabId = 'users' | 'scan' | 'enrich';

const tabs = [
  { id: 'users' as TabId, label: 'Users' },
  { id: 'scan' as TabId, label: 'Scan' },
  { id: 'enrich' as TabId, label: 'Enrich' },
];

export const Admin: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<TabId>('users');

  const isAdmin = user?.role === 'admin';

  if (!isAdmin) {
    return (
      <EmptyState
        title="Access Denied"
        description="You need admin privileges to access this page."
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl" style={{ marginBottom: 'var(--space-4)' }}>
        Admin
      </h1>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'scan' && <ScanTab />}
      {activeTab === 'enrich' && <EnrichTab />}
    </div>
  );
};

Admin.displayName = 'Admin';

// ─── Users Tab ────────────────────────────────────────────

const UsersTab: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AdminUser[]>('/admin/users')
      .then(setUsers)
      .catch(() => addToast('Failed to load users. Admin endpoint may not exist yet.', 'error'))
      .finally(() => setLoading(false));
  }, [addToast]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <EmptyState
        title="No users found"
        description="The admin users endpoint may not be implemented yet."
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 1fr auto',
          gap: '8px 16px',
          alignItems: 'center',
          padding: '0 0 8px',
          borderBottom: '1px solid var(--border-primary)',
          color: 'var(--text-tertiary)',
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <span>ID</span>
        <span>Username</span>
        <span>Role</span>
        <span>Created</span>
      </div>
      {users.map((u) => (
        <div
          key={u.id}
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr 1fr auto',
            gap: '8px 16px',
            alignItems: 'center',
            padding: '10px 0',
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {u.id}
          </span>
          <span className="text-sm" style={{ fontWeight: 500 }}>
            {u.username}
          </span>
          <span
            className="text-xs"
            style={{
              color: u.role === 'admin' ? 'var(--bg-accent)' : 'var(--text-secondary)',
              fontWeight: u.role === 'admin' ? 600 : 400,
            }}
          >
            {u.role}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Scan Tab ─────────────────────────────────────────────

interface ScanLogEntry {
  timestamp: number;
  message: string;
}

const ScanTab: React.FC = () => {
  const addToast = useUIStore((s) => s.addToast);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [completed, setCompleted] = useState(false);
  // M4: scan stats
  const [stats, setStats] = useState({ files: 0, tracks: 0, albums: 0, artists: 0 });
  // M4: scan log
  const [log, setLog] = useState<ScanLogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  // M5: reader ref for cleanup
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [log]);

  // M5: Cancel reader on unmount
  useEffect(() => {
    return () => {
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
        readerRef.current = null;
      }
    };
  }, []);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [...prev.slice(-49), { timestamp: Date.now(), message }]);
  }, []);

  const startScan = useCallback(async () => {
    setScanning(true);
    setCompleted(false);
    setProgress(null);
    setLog([]);
    setStats({ files: 0, tracks: 0, albums: 0, artists: 0 });

    try {
      // M6: Use apiRaw for SSE stream (auto-attaches auth, handles 401)
      const res = await apiRaw('/admin/scan', { method: 'GET' });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: ScanProgress = JSON.parse(line.slice(6));
                setProgress(data);
                addLog(data.message || `${data.phase}: ${data.current}/${data.total}`);
                // M4: extract stats from progress messages if available
                if (data.message) {
                  const fileMatch = data.message.match(/(\d+)\s*files?/i);
                  const trackMatch = data.message.match(/(\d+)\s*tracks?/i);
                  const albumMatch = data.message.match(/(\d+)\s*albums?/i);
                  const artistMatch = data.message.match(/(\d+)\s*artists?/i);
                  setStats((prev) => ({
                    files: fileMatch ? parseInt(fileMatch[1]) : prev.files,
                    tracks: trackMatch ? parseInt(trackMatch[1]) : prev.tracks,
                    albums: albumMatch ? parseInt(albumMatch[1]) : prev.albums,
                    artists: artistMatch ? parseInt(artistMatch[1]) : prev.artists,
                  }));
                }
              } catch { /* not JSON */ }
            }
          }
        }
        readerRef.current = null;
        setCompleted(true);
        addLog('Scan completed successfully.');
      } else {
        await res.json().catch(() => ({}));
        setCompleted(true);
        addLog('Scan completed (non-streaming response).');
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Scan failed. Admin endpoint may not exist yet.', 'error');
      addLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setScanning(false);
      readerRef.current = null;
    }
  }, [addToast, addLog]);

  return (
    <div>
      <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
        Scan your music library to discover new tracks, albums, and artists.
      </p>

      <Button variant="primary" loading={scanning} onClick={startScan} disabled={scanning}>
        {scanning ? 'Scanning…' : 'Start Scan'}
      </Button>

      {/* M4: Stats counters */}
      {(progress || completed) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginTop: 'var(--space-4)',
          }}
        >
          {[
            { label: 'Files', value: stats.files },
            { label: 'Tracks', value: stats.tracks },
            { label: 'Albums', value: stats.albums },
            { label: 'Artists', value: stats.artists },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)',
                textAlign: 'center',
              }}
            >
              <p className="text-2xl" style={{ fontWeight: 600 }}>
                {s.value}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {progress && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <div
            style={{
              width: '100%',
              height: 6,
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 3,
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                height: '100%',
                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
                backgroundColor: 'var(--bg-accent)',
                borderRadius: 3,
                transition: 'width 0.3s var(--easing-default)',
              }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {progress.phase} — {progress.current}/{progress.total}
          </p>
          {progress.message && (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
              {progress.message}
            </p>
          )}
        </div>
      )}

      {completed && !scanning && (
        <p className="text-sm" style={{ color: 'var(--bg-success)', marginTop: 'var(--space-4)' }}>
          Scan completed.
        </p>
      )}

      {/* M4: Scrollable log list */}
      {log.length > 0 && (
        <div
          style={{
            marginTop: 'var(--space-4)',
            maxHeight: 200,
            overflowY: 'auto',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)',
            padding: '8px 12px',
          }}
        >
          <p
            className="text-xs"
            style={{
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}
          >
            Log (last {log.length})
          </p>
          {[...log].reverse().map((entry, i) => (
            <p
              key={`${entry.timestamp}-${i}`}
              className="text-xs"
              style={{
                color: entry.message.startsWith('Error') ? 'var(--bg-danger)' : 'var(--text-secondary)',
                lineHeight: '18px',
              }}
            >
              <span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>{' '}
              {entry.message}
            </p>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {!progress && !scanning && !completed && (
        <EmptyState
          title="Ready to scan"
          description="Click 'Start Scan' to discover music in your library."
        />
      )}
    </div>
  );
};

// ─── Enrich Tab ───────────────────────────────────────────

const EnrichTab: React.FC = () => (
  <EmptyState
    title="Enrichment"
    description="Phase 2 — coming soon."
  />
);
