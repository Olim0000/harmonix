/**
 * ListRow — horizontal row for track lists.
 * Height 48px, border-bottom, hover bg-tertiary.
 * Active row: bg-accent with 0.1 opacity, accent border-left.
 */
import React, { useState } from 'react';
import { toggleLike } from '../../api/library';
import { HeartIcon, HeartFilledIcon, PlayIcon } from '../icons';
import { useUIStore } from '../../stores/ui';
import { formatDuration } from '../../utils/format';

interface ListRowProps {
  index?: number;
  title: string;
  subtitle?: string;
  duration?: number | null;
  trackId?: number;
  isActive?: boolean;
  onClick?: () => void;
  /** For "Add to Queue" or "Play Next" actions — placeholders for P1c-2 */
  onPlay?: () => void;
}

export const ListRow: React.FC<ListRowProps> = ({
  index,
  title,
  subtitle,
  duration,
  trackId,
  isActive = false,
  onClick,
  onPlay,
}) => {
  const addToast = useUIStore((s) => s.addToast);
  const [liked, setLiked] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!trackId) return;
    try {
      const res = await toggleLike('track', trackId);
      setLiked(res.liked);
    } catch {
      addToast('Failed to toggle like', 'error');
    }
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: 48,
    padding: '0 12px',
    borderBottom: '1px solid var(--border-primary)',
    cursor: onClick ? 'pointer' : 'default',
    backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
    borderLeft: isActive ? '3px solid var(--bg-accent)' : '3px solid transparent',
    transition: `background-color var(--duration-fast) var(--easing-default)`,
    gap: 12,
  };

  return (
    <div
      style={rowStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {index != null && (
        <span
          className="text-xs"
          style={{
            color: 'var(--text-tertiary)',
            width: 24,
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {index}
        </span>
      )}

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
          {title}
        </p>
        {subtitle && (
          <p
            className="text-xs"
            style={{
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {duration != null && (
        <span
          className="text-xs"
          style={{
            color: 'var(--text-tertiary)',
            width: 40,
            textAlign: 'right',
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatDuration(duration)}
        </span>
      )}

      {onPlay && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
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
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
          aria-label="Play"
        >
          <PlayIcon size={14} />
        </button>
      )}

      {trackId && (
        <button
          onClick={handleLike}
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
            color: liked ? 'var(--bg-danger)' : 'var(--text-tertiary)',
            flexShrink: 0,
            transition: 'color var(--duration-fast) var(--easing-spring)',
          }}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          {liked ? <HeartFilledIcon size={14} /> : <HeartIcon size={14} />}
        </button>
      )}
    </div>
  );
};

ListRow.displayName = 'ListRow';
