/**
 * PlaylistDetail page (T33) — playlist detail with tracklist, drag-to-reorder.
 *
 * Header: title (editable), track count, duration.
 * Action bar: Play, Shuffle, Delete Playlist.
 * Tracklist: track number, title, artist, duration, remove button.
 * Drag-to-reorder: HTML5 DnD with drag handle and visual insertion indicator.
 * Duplicate detection: warning toast when adding a track already in the playlist.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchPlaylistDetail,
  renamePlaylist,
  deletePlaylist,
  removeTrackFromPlaylist,
  reorderPlaylist,
} from '../api/playlists';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { useUIStore } from '../stores/ui';
import { usePlayerStore } from '../stores/player';
import { coverUrl } from '../api/client';
import { addTrackToPlaylist } from '../api/playlists';
import { PlaylistCoverCollage } from '../components/ui/PlaylistCoverCollage';
import { formatDuration, formatTotalDuration } from '../utils/format';
import type { PlaylistDetailResponse } from '../types/api';

export const PlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const { enqueue, playTrack, currentTrack, isPlaying } = usePlayerStore();

  const [data, setData] = useState<PlaylistDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // DnD state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchPlaylistDetail(Number(id));
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlist');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const totalDuration = useMemo(() => {
    if (!data) return null;
    return data.tracks.reduce((sum, t) => sum + (t.duration_seconds || 0), 0);
  }, [data]);

  // ── Rename ──────────────────────────────────────────────

  const handleRename = async () => {
    if (!data || !id) return;
    const name = editName.trim();
    if (!name || name === data.playlist.name) {
      setEditing(false);
      return;
    }
    try {
      const updated = await renamePlaylist(Number(id), name);
      setData((prev) => (prev ? { ...prev, playlist: { ...prev.playlist, name: updated.name } } : prev));
      addToast(`Renamed to "${name}"`, 'success');
    } catch {
      addToast('Failed to rename playlist', 'error');
    }
    setEditing(false);
  };

  // ── Delete playlist ─────────────────────────────────────

  const handleDelete = async () => {
    if (!data || !id) return;
    if (!window.confirm(`Delete playlist "${data.playlist.name}"?`)) return;
    try {
      await deletePlaylist(Number(id));
      addToast(`Deleted "${data.playlist.name}"`, 'info');
      navigate('/playlists');
    } catch {
      addToast('Failed to delete playlist', 'error');
    }
  };

  // ── Remove track ────────────────────────────────────────

  const handleRemoveTrack = async (trackId: number) => {
    if (!id) return;
    try {
      await removeTrackFromPlaylist(Number(id), trackId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              playlist: { ...prev.playlist, track_count: prev.playlist.track_count - 1 },
              tracks: prev.tracks.filter((t) => t.id !== trackId),
            }
          : prev
      );
      addToast('Track removed', 'info');
    } catch {
      addToast('Failed to remove track', 'error');
    }
  };

  // ── Play / Shuffle ──────────────────────────────────────

  const handlePlay = () => {
    if (!data || data.tracks.length === 0) return;
    playTrack(data.tracks[0].id);
  };

  const handleShuffle = () => {
    if (!data || data.tracks.length === 0) return;
    const randomIdx = Math.floor(Math.random() * data.tracks.length);
    playTrack(data.tracks[randomIdx].id);
  };

  // ── Add track (with duplicate detection — H9) ────────────

  const handleAddTrack = async (trackId: number) => {
    if (!id) return;
    // Check for duplicate (H9)
    if (data?.tracks.some((t) => t.id === trackId)) {
      addToast('This track is already in this playlist', 'error');
      return;
    }
    try {
      await addTrackToPlaylist(Number(id), trackId);
      addToast('Track added to playlist', 'success');
      load(); // Reload to get updated track list
    } catch {
      addToast('Failed to add track', 'error');
    }
  };

  // ── DnD handlers ────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIndex(index);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragIndex == null || dragIndex === toIndex || !data || !id) {
        setDragIndex(null);
        setOverIndex(null);
        return;
      }

      const tracks = [...data.tracks];
      const [moved] = tracks.splice(dragIndex, 1);
      tracks.splice(toIndex, 0, moved);

      // Optimistic update
      setData({ ...data, tracks });

      try {
        await reorderPlaylist(Number(id), tracks.map((t) => t.id));
      } catch {
        addToast('Failed to reorder tracks', 'error');
        load(); // Reload on failure
      }

      setDragIndex(null);
      setOverIndex(null);
    },
    [dragIndex, data, id, addToast, load]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  // ── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !data) {
    return <EmptyState title="Playlist not found" description={error || 'Could not load playlist'} />;
  }

  const { playlist, tracks } = data;

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-6)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
        }}
      >
        {/* Playlist cover collage (H8) */}
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <PlaylistCoverCollage playlistId={Number(id)} cellSize={100} />
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          {editing ? (
            <input
              ref={inputRef}
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={handleRename}
              style={{
                width: '100%',
                padding: '4px 8px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 24,
                fontWeight: 600,
                outline: 'none',
              }}
            />
          ) : (
            <h1
              className="text-2xl"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setEditName(playlist.name);
                setEditing(true);
              }}
              title="Click to rename"
            >
              {playlist.name}
            </h1>
          )}

          <div className="text-sm" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            <span>{playlist.track_count} track{playlist.track_count !== 1 ? 's' : ''}</span>
            {totalDuration != null && totalDuration > 0 && (
              <span> &middot; {formatTotalDuration(totalDuration)}</span>
            )}
          </div>

          {/* Action bar */}
          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)' }}>
            <Button
              variant="primary"
              onClick={handlePlay}
              disabled={tracks.length === 0}
            >
              Play
            </Button>
            <Button
              variant="secondary"
              onClick={handleShuffle}
              disabled={tracks.length === 0}
            >
              Shuffle
            </Button>
            <Button variant="danger" onClick={handleDelete} style={{ marginLeft: 'auto' }}>
              Delete Playlist
            </Button>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      {tracks.length === 0 ? (
        <EmptyState
          title="This playlist is empty"
          description="Add tracks from Library or Search."
        />
      ) : (
        <div>
          {/* Table header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px 8px',
              borderBottom: '1px solid var(--border-primary)',
              color: 'var(--text-tertiary)',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ width: 36, flexShrink: 0 }}>#</span>
            <span style={{ width: 32, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Title</span>
            <span style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>Duration</span>
            <span style={{ width: 36, flexShrink: 0 }} />
          </div>

          {tracks.map((track, index) => {
            const isActive = currentTrack?.id === track.id;
            const isDragOver = overIndex === index;

            return (
              <div
                key={track.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 48,
                  padding: '0 12px',
                  borderBottom: isDragOver ? '2px solid var(--bg-accent)' : '1px solid var(--border-primary)',
                  backgroundColor: isActive
                    ? 'rgba(37, 99, 235, 0.1)'
                    : dragIndex === index
                    ? 'var(--bg-tertiary)'
                    : 'transparent',
                  borderLeft: isActive ? '3px solid var(--bg-accent)' : '3px solid transparent',
                  transition: 'background-color var(--duration-fast) var(--easing-default)',
                  gap: 12,
                  opacity: dragIndex === index ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive && dragIndex == null) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive && dragIndex == null && !isDragOver) e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => playTrack(track.id)}
              >
                {/* Track number */}
                <span
                  className="text-xs"
                  style={{
                    color: 'var(--text-tertiary)',
                    width: 24,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>

                {/* Drag handle */}
                <span
                  style={{
                    color: 'var(--text-tertiary)',
                    cursor: 'grab',
                    fontSize: 12,
                    width: 20,
                    flexShrink: 0,
                    userSelect: 'none',
                    textAlign: 'center',
                  }}
                  aria-label="Drag to reorder"
                >
                  ⠿
                </span>

                {/* Track info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    className="text-sm"
                    style={{
                      fontWeight: isActive ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {track.title}
                  </p>
                  <p
                    className="text-xs"
                    style={{
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {track.artist_name || 'Unknown Artist'}
                  </p>
                </div>

                {/* Duration */}
                <span
                  className="text-xs"
                  style={{
                    color: 'var(--text-tertiary)',
                    width: 48,
                    textAlign: 'right',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatDuration(track.duration_seconds)}
                </span>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTrack(track.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-sm)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    flexShrink: 0,
                  }}
                  aria-label="Remove from playlist"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

PlaylistDetail.displayName = 'PlaylistDetail';
