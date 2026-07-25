/**
 * AlbumCard — 1:1 cover, title, artist, hover play overlay, heart.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { coverUrl } from '../../api/client';
import { toggleLike } from '../../api/library';
import { HeartIcon, HeartFilledIcon, PlayIcon } from '../icons';
import { useUIStore } from '../../stores/ui';
import type { Album } from '../../types/api';

interface AlbumCardProps {
  album: Album;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album }) => {
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const [liked, setLiked] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await toggleLike('album', album.id);
      setLiked(res.liked);
    } catch {
      addToast('Failed to toggle like', 'error');
    }
  };

  return (
    <div
      style={{
        cursor: 'pointer',
        borderRadius: 'var(--radius-md)',
        transition: `transform var(--duration-fast) var(--easing-default), box-shadow var(--duration-fast) var(--easing-default)`,
      }}
      className="album-card"
      onClick={() => navigate(`/albums/${album.id}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.02)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '100%',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-tertiary)',
        }}
      >
        <img
          src={coverUrl('album', album.id)}
          alt={album.title}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          loading="lazy"
        />
        {/* Play overlay on hover */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
          }}
          className="play-overlay"
        >
          <PlayIcon size={18} />
        </div>
        {/* Heart icon */}
        <button
          onClick={handleLike}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-full)',
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: liked ? 'var(--bg-danger)' : 'var(--text-primary)',
            transition: 'color var(--duration-fast) var(--easing-spring)',
          }}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          {liked ? <HeartFilledIcon size={14} /> : <HeartIcon size={14} />}
        </button>
      </div>
      <div style={{ padding: '8px 4px' }}>
        <p
          className="text-sm"
          style={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {album.title}
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
          {album.artist_name || 'Unknown Artist'}
        </p>
      </div>
    </div>
  );
};

AlbumCard.displayName = 'AlbumCard';
