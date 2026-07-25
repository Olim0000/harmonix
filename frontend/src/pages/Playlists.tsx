/**
 * Playlists page (T32) — list/create playlists.
 *
 * Header: "Playlists" + "New Playlist" button.
 * Grid: playlist cards (3 cols desktop, 2 mobile via .album-card-grid).
 * Each card: title, track count. Click navigates to /playlists/:id.
 * Right-click or menu: rename, delete.
 * Empty state, loading state.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPlaylists, createPlaylist, renamePlaylist, deletePlaylist } from '../api/playlists';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useUIStore } from '../stores/ui';
import { PlaylistCoverCollage } from '../components/ui/PlaylistCoverCollage';
import type { Playlist } from '../types/api';

export const Playlists: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlaylists();
      setPlaylists(data);
    } catch {
      addToast('Failed to load playlists', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Close menu on outside click
  useEffect(() => {
    if (menuFor == null) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuFor]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const pl = await createPlaylist(name);
      setPlaylists((prev) => [...prev, pl]);
      setNewName('');
      addToast(`Created "${name}"`, 'success');
    } catch {
      addToast('Failed to create playlist', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: number) => {
    const name = renameValue.trim();
    if (!name) return;
    try {
      const updated = await renamePlaylist(id, name);
      setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name: updated.name } : p)));
      addToast(`Renamed to "${name}"`, 'success');
    } catch {
      addToast('Failed to rename playlist', 'error');
    } finally {
      setRenamingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete playlist "${name}"?`)) return;
    try {
      await deletePlaylist(id);
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      addToast(`Deleted "${name}"`, 'info');
    } catch {
      addToast('Failed to delete playlist', 'error');
    }
    setMenuFor(null);
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
        <h1 className="text-2xl">Playlists</h1>
      </div>

      {/* Create form */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 'var(--space-6)',
          maxWidth: 400,
        }}
      >
        <Input
          ref={inputRef}
          placeholder="New playlist name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
          style={{ flex: 1 }}
        />
        <Button
          variant="primary"
          size="md"
          loading={creating}
          onClick={handleCreate}
          disabled={!newName.trim()}
        >
          New Playlist
        </Button>
      </div>

      {playlists.length === 0 ? (
        <EmptyState
          title="No playlists yet"
          description="Create a playlist to get started."
        />
      ) : (
        <div
          className="album-card-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {playlists.map((pl) => (
            <div
              key={pl.id}
              style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
                padding: 'var(--space-4)',
                transition: `transform var(--duration-fast) var(--easing-default), box-shadow var(--duration-fast) var(--easing-default)`,
                minHeight: 120,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onClick={() => navigate(`/playlists/${pl.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                {/* Playlist cover collage (H7) */}
                <div style={{ marginBottom: 12 }}>
                  <PlaylistCoverCollage playlistId={pl.id} cellSize={28} />
                </div>

                {renamingId === pl.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(pl.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={() => handleRename(pl.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      padding: '2px 4px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-accent)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                      fontWeight: 500,
                      outline: 'none',
                    }}
                  />
                ) : (
                  <p
                    className="text-sm"
                    style={{
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pl.name}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {pl.track_count} track{pl.track_count !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(menuFor === pl.id ? null : pl.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 'var(--radius-sm)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                  aria-label="More options"
                >
                  ⋯
                </button>
              </div>

              {/* Context menu */}
              {menuFor === pl.id && (
                <div
                  ref={menuRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: 140,
                    zIndex: 100,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(pl.id);
                      setRenameValue(pl.name);
                      setMenuFor(null);
                    }}
                    style={menuItemStyle}
                  >
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(pl.id, pl.name);
                    }}
                    style={{ ...menuItemStyle, color: 'var(--bg-danger)' }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

Playlists.displayName = 'Playlists';

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  textAlign: 'left',
  backgroundColor: 'transparent',
  border: 'none',
  color: 'var(--text-primary)',
  fontSize: 13,
  cursor: 'pointer',
  borderBottom: '1px solid var(--border-primary)',
};

// Playlist icon (folder with lines)
const PlaylistIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1z" />
    <path d="M6 9h8" />
    <path d="M6 12h5" />
  </svg>
);
