/**
 * QueueDrawer (T36) — slides from right, shows current queue.
 * 320px on desktop, full-width on mobile.
 * Supports drag-to-reorder with HTML5 DnD.
 * Sections: "Now Playing", "Up Next" (split at queueIndex).
 */
import React, { useCallback, useState } from 'react';
import { usePlayerStore } from '../stores/player';
import { useUIStore } from '../stores/ui';
import { coverUrl } from '../api/client';
import { formatDuration } from '../utils/format';
import { CloseIcon, TrashIcon } from './icons';
import { EmptyState } from './ui/EmptyState';

export const QueueDrawer: React.FC = () => {
  const {
    queue,
    queueIndex,
    queueOpen,
    setQueueOpen,
    playFromQueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
  } = usePlayerStore();
  const addToast = useUIStore((s) => s.addToast);

  // DnD state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Hover state (replaces direct DOM manipulation — M9)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      // Required for Firefox
      e.dataTransfer.setData('text/plain', String(index));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setOverIndex(index);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragIndex != null && dragIndex !== toIndex) {
        reorderQueue(dragIndex, toIndex);
      }
      setDragIndex(null);
      setOverIndex(null);
    },
    [dragIndex, reorderQueue]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  if (!queueOpen) return null;

  // Split queue into Now Playing + Up Next
  const nowPlayingItem = queue.length > 0 ? queue[queueIndex] : null;
  const upNextItems = queue.slice(queueIndex + 1);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setQueueOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 150,
          transition: 'opacity var(--duration-normal) var(--easing-default)',
        }}
      />

      {/* Drawer */}
      <div
        className="queue-drawer"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'var(--queue-width)',
          maxWidth: '100vw',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-primary)',
          zIndex: 160,
          display: 'flex',
          flexDirection: 'column',
          transform: 'translateX(0)',
          transition: 'transform var(--duration-normal) var(--easing-default)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-primary)',
            minHeight: 48,
          }}
        >
          <h2 className="text-base" style={{ fontWeight: 600 }}>
            Queue
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {queue.length > 0 && (
              <button
                onClick={() => {
                  clearQueue();
                  addToast('Queue cleared', 'info');
                }}
                className="text-xs"
                style={{
                  color: 'var(--text-secondary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setQueueOpen(false)}
              style={{
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
              }}
              aria-label="Close queue"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Queue list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {queue.length === 0 ? (
            <EmptyState
              title="Queue is empty"
              description="Add tracks from anywhere."
            />
          ) : (
            <div style={{ padding: '4px 0' }}>
              {/* Now Playing section */}
              {nowPlayingItem && (
                <>
                  <SectionHeader>Now Playing</SectionHeader>
                  <QueueItemRow
                    item={nowPlayingItem}
                    index={queueIndex}
                    isNowPlaying
                    dragIndex={dragIndex}
                    overIndex={overIndex}
                    hoverIndex={hoverIndex}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onClick={() => playFromQueue(queueIndex)}
                    onRemove={() => removeFromQueue(queueIndex)}
                    onHover={setHoverIndex}
                  />
                </>
              )}

              {/* Up Next section */}
              {upNextItems.length > 0 && (
                <>
                  <SectionHeader>Up Next</SectionHeader>
                  {upNextItems.map((item, i) => {
                    const realIndex = queueIndex + 1 + i;
                    return (
                      <QueueItemRow
                        key={item.track.id}
                        item={item}
                        index={realIndex}
                        isNowPlaying={false}
                        dragIndex={dragIndex}
                        overIndex={overIndex}
                        hoverIndex={hoverIndex}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        onClick={() => playFromQueue(realIndex)}
                        onRemove={() => removeFromQueue(realIndex)}
                        onHover={setHoverIndex}
                      />
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .queue-drawer { width: 100vw !important; }
        }
      `}</style>
    </>
  );
};

QueueDrawer.displayName = 'QueueDrawer';

// ─── Section header ──────────────────────────────────────

const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: '10px 16px 4px',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}
  >
    {children}
  </div>
);

// ─── Queue item row ──────────────────────────────────────

interface QueueItemRowProps {
  item: import('../types/api').QueueItem;
  index: number;
  isNowPlaying: boolean;
  dragIndex: number | null;
  overIndex: number | null;
  hoverIndex: number | null;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onClick: () => void;
  onRemove: () => void;
  onHover: (index: number | null) => void;
}

const QueueItemRow: React.FC<QueueItemRowProps> = ({
  item,
  index,
  isNowPlaying,
  dragIndex,
  overIndex,
  hoverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClick,
  onRemove,
  onHover,
}) => {
  const isDragging = dragIndex === index;
  const isDragOver = overIndex === index;
  const isHovered = hoverIndex === index;

  const bgColor = isNowPlaying
    ? 'rgba(37, 99, 235, 0.15)'
    : isDragOver
    ? 'rgba(37, 99, 235, 0.05)'
    : isHovered && !isDragging
    ? 'var(--bg-tertiary)'
    : 'transparent';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        gap: 10,
        cursor: 'pointer',
        backgroundColor: bgColor,
        borderBottom: isDragOver
          ? '2px solid var(--bg-accent)'
          : '1px solid transparent',
        transition: 'background-color var(--duration-fast) var(--easing-default)',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Drag handle */}
      <span
        style={{
          color: 'var(--text-tertiary)',
          cursor: 'grab',
          fontSize: 12,
          lineHeight: 1,
          userSelect: 'none',
        }}
        aria-label="Drag to reorder"
      >
        ⠿
      </span>

      {/* Art thumbnail */}
      {item.track.album_id > 0 && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-tertiary)',
            flexShrink: 0,
          }}
        >
          <img
            src={coverUrl('album', item.track.album_id)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Track info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          className="text-sm"
          style={{
            fontWeight: isNowPlaying ? 600 : 400,
            color: isNowPlaying ? 'var(--bg-accent)' : 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.track.title}
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
          {item.track.artist_name || 'Unknown Artist'}
          {item.source ? ` · ${item.source}` : ''}
        </p>
      </div>

      {/* Duration */}
      <span
        className="text-xs"
        style={{
          color: 'var(--text-tertiary)',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatDuration(item.track.duration_seconds)}
      </span>

      {/* Remove button (H2) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
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
          flexShrink: 0,
        }}
        aria-label="Remove from queue"
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
};
