/**
 * Discriminated union for range-parsing results, so callers can distinguish:
 * - no Range header requested     → 200 full file
 * - valid range requested         → 206 partial content
 * - invalid range requested       → 416 Range Not Satisfiable
 */
export type RangeResult =
  | { kind: 'none' }
  | { kind: 'range'; start: number; end: number }
  | { kind: 'invalid' };

/**
 * Parse an HTTP Range header.
 *
 * Supports:
 * - `bytes=start-end` (bounded)
 * - `bytes=start-`    (open-ended end → until file end)
 * - `bytes=-suffix`   (last N bytes, per RFC 7233 section 2.1)
 *
 * Returns a discriminated result so callers can route to 200/206/416 correctly.
 */
export function parseRangeHeader(
  rangeHeader: string | undefined,
  fileSize: number
): RangeResult {
  if (!rangeHeader) return { kind: 'none' };

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return { kind: 'invalid' };

  // bytes=-suffix → last N bytes (RFC 7233 section 2.1)
  if (match[1] === '' && match[2] !== '') {
    const suffix = parseInt(match[2], 10);
    // If suffix <= 0 or suffix >= fileSize, return full file? RFC says:
    // "If the selected representation is shorter than the specified suffix-length,
    //  the entire representation is used." but for our purposes the caller handles
    //  this via the start being negative (clamped below) or we accept the range.
    if (suffix <= 0) return { kind: 'invalid' };
    const start = Math.max(0, fileSize - suffix);
    const end = fileSize - 1;
    return { kind: 'range', start, end };
  }

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  // Validate: start must be < fileSize, end must be < fileSize, start <= end
  if (start >= fileSize || end >= fileSize || start > end) {
    return { kind: 'invalid' };
  }

  return { kind: 'range', start, end };
}

export interface ParsedRange {
  start: number;
  end: number;
}

export function formatContentRange(range: ParsedRange, fileSize: number): string {
  return `bytes ${range.start}-${range.end}/${fileSize}`;
}