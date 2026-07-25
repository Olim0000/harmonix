/**
 * Inline SVG icon set.
 * Style: 20x20 viewBox, 1.5px stroke, stroke-linecap round, stroke-linejoin round.
 * Filled variants where noted.
 */
import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function withIcon(child: React.ReactNode): React.FC<IconProps> {
  const Component: React.FC<IconProps> = ({ size = 20, className }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {child}
    </svg>
  );
  Component.displayName = 'Icon';
  return Component;
}

/* ─── Navigation ──────────────────────────────────────────── */

export const HomeIcon = withIcon(
  <path d="M2 10l8-7 8 7M4 8.5V17a1 1 0 001 1h3v-4a1 1 0 011-1h2a1 1 0 011 1v4h3a1 1 0 001-1V8.5" />
);

export const LibraryIcon = withIcon(
  <>
    <rect x="3" y="3" width="4" height="14" rx="1" />
    <rect x="9" y="5" width="4" height="12" rx="1" />
    <rect x="15" y="8" width="3" height="9" rx="1" />
  </>
);

export const ArtistsIcon = withIcon(
  <>
    <path d="M10 9a3 3 0 100-6 3 3 0 000 6z" />
    <path d="M2 18c0-4 3.58-7 8-7s8 3 8 7" />
  </>
);

export const SearchIcon = withIcon(
  <circle cx="8.5" cy="8.5" r="5.5" transform="rotate(-45 8.5 8.5)" />
);

export const SettingsIcon = withIcon(
  <circle cx="10" cy="10" r="2" />
);

export const MenuIcon = withIcon(
  <>
    <path d="M3 5h14" />
    <path d="M3 10h14" />
    <path d="M3 15h14" />
  </>
);

export const CloseIcon = withIcon(
  <path d="M5 5l10 10M15 5L5 15" />
);

/* ─── Actions / UI ────────────────────────────────────────── */

export const HeartIcon = withIcon(
  <path d="M10 17.5l-1.5-1.3C4.5 12.9 2 10.7 2 8 2 5.8 3.8 4 6 4c1.4 0 2.7.7 3.5 1.7l.5.6.5-.6C11.3 4.7 12.6 4 14 4c2.2 0 4 1.8 4 4 0 2.7-2.5 4.9-6.5 8.2L10 17.5z" />
);

export const HeartFilledIcon = withIcon(
  <path d="M10 17.5l-1.5-1.3C4.5 12.9 2 10.7 2 8 2 5.8 3.8 4 6 4c1.4 0 2.7.7 3.5 1.7l.5.6.5-.6C11.3 4.7 12.6 4 14 4c2.2 0 4 1.8 4 4 0 2.7-2.5 4.9-6.5 8.2L10 17.5z" fill="currentColor" />
);

export const PlusIcon = withIcon(
  <>
    <path d="M10 4v12" />
    <path d="M4 10h12" />
  </>
);

export const MinusIcon = withIcon(
  <path d="M4 10h12" />
);

export const TrashIcon = withIcon(
  <>
    <path d="M3 5h14" />
    <path d="M6 5V3a1 1 0 011-1h6a1 1 0 011 1v2" />
    <path d="M5 5l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12" />
  </>
);

export const EditIcon = withIcon(
  <path d="M14 2l4 4-9 9H5v-4l9-9z" />
);

export const CheckIcon = withIcon(
  <path d="M4 10l4 4 8-8" />
);

export const XIcon = withIcon(
  <circle cx="10" cy="10" r="8" />
);

export const RefreshIcon = withIcon(
  <>
    <path d="M1 10a9 9 0 0118 0" />
    <path d="M17 1v5h-5" />
    <path d="M19 10a9 9 0 01-18 0" />
    <path d="M3 19v-5h5" />
  </>
);

export const ChevronDownIcon = withIcon(
  <path d="M5 8l5 5 5-5" />
);

export const ChevronRightIcon = withIcon(
  <path d="M8 5l5 5-5 5" />
);

/* ─── Playback ────────────────────────────────────────────── */

export const PlayIcon = withIcon(
  <path d="M5 3l12 7-12 7V3z" fill="currentColor" />
);

export const PauseIcon = withIcon(
  <>
    <rect x="5" y="3" width="4" height="14" rx="1" fill="currentColor" />
    <rect x="11" y="3" width="4" height="14" rx="1" fill="currentColor" />
  </>
);

export const SkipNextIcon = withIcon(
  <>
    <path d="M4 4l8 6-8 6V4z" />
    <path d="M14 4v12" />
  </>
);

export const SkipPrevIcon = withIcon(
  <>
    <path d="M16 4l-8 6 8 6V4z" />
    <path d="M6 4v12" />
  </>
);

export const ShuffleIcon = withIcon(
  <>
    <path d="M16 3h3v3" />
    <path d="M1 17l5-5" />
    <path d="M19 3l-6 6" />
    <path d="M1 3l5 5" />
    <path d="M14 14l5 5h-3v-3" />
  </>
);

export const RepeatIcon = withIcon(
  <path d="M3 10a7 7 0 0114 0 7 7 0 01-7 7" />
);

/* ─── Status / Server ─────────────────────────────────────── */

export const ServerIcon = withIcon(
  <>
    <rect x="3" y="3" width="14" height="14" rx="2" />
    <path d="M3 8h14" />
    <path d="M8 8v6" />
  </>
);

export const VolumeHighIcon = withIcon(
  <>
    <path d="M2 7h3l4-4v14L5 13H2V7z" />
    <path d="M14 6a5 5 0 010 8" />
    <path d="M16 3a9 9 0 010 14" />
  </>
);

export const ExternalLinkIcon = withIcon(
  <>
    <path d="M11 3h6v6" />
    <path d="M17 3L9 11" />
    <path d="M15 12v4a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1h4" />
  </>
);

/* ─── Indicator dots ──────────────────────────────────────── */

export const DotIcon: React.FC<IconProps & { color?: string }> = ({
  size = 8,
  color = 'currentColor',
  className,
}) => (
  <svg width={size} height={size} viewBox="0 0 8 8" fill={color} className={className}>
    <circle cx="4" cy="4" r="3" />
  </svg>
);
DotIcon.displayName = 'DotIcon';
