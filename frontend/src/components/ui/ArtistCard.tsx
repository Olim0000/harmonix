/**
 * ArtistCard — circular avatar (120px), name, album count.
 * Square with music-note fallback for missing image_path.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { coverUrl } from '../../api/client';
import type { Artist } from '../../types/api';

interface ArtistCardProps {
  artist: Artist;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ artist }) => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        padding: 'var(--space-2)',
        borderRadius: 'var(--radius-md)',
        transition: `background-color var(--duration-fast) var(--easing-default)`,
        textAlign: 'center',
      }}
      onClick={() => navigate(`/artists/${artist.id}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <img
          src={coverUrl('artist', artist.id)}
          alt={artist.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          loading="lazy"
          onError={(e) => {
            // Fallback: show music note
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* If image is broken or missing, music note SVG fallback is served by backend */}
      </div>
      <p
        className="text-sm"
        style={{
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 140,
        }}
      >
        {artist.name}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {artist.album_count != null
          ? `${artist.album_count} album${artist.album_count !== 1 ? 's' : ''}`
          : ''}
      </p>
    </div>
  );
};

ArtistCard.displayName = 'ArtistCard';
