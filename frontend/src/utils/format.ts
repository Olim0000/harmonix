/**
 * Format utility functions.
 */

/**
 * Format a duration in seconds to "m:ss" format.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds == null || isNaN(seconds)) return '--:--';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format total seconds to a human-readable "X hr Y min" string.
 */
export function formatTotalDuration(seconds: number | null): string {
  if (seconds == null || isNaN(seconds)) return '';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}
