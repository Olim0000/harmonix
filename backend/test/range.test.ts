import { describe, it, expect } from 'vitest';
import { parseRangeHeader, formatContentRange, type RangeResult } from '@/lib/range.js';

describe('parseRangeHeader', () => {
  /** Helper: fileSize=1000 for standard tests */
  const SIZE = 1000;

  it('returns {kind:"none"} when no Range header is provided', () => {
    const result = parseRangeHeader(undefined, SIZE);
    expect(result).toEqual({ kind: 'none' });
  });

  it('returns {kind:"range"} for a normal bounded range (bytes=0-99)', () => {
    const result = parseRangeHeader('bytes=0-99', SIZE);
    expect(result).toEqual({ kind: 'range', start: 0, end: 99 });
  });

  it('returns {kind:"range"} with open-ended start (bytes=100-), end=fileSize-1', () => {
    const result = parseRangeHeader('bytes=100-', SIZE);
    expect(result).toEqual({ kind: 'range', start: 100, end: SIZE - 1 });
  });

  it('returns {kind:"range"} with open-ended end (bytes=-500), start=fileSize-500, end=fileSize-1', () => {
    const result = parseRangeHeader('bytes=-500', SIZE);
    expect(result).toEqual({ kind: 'range', start: SIZE - 500, end: SIZE - 1 });
  });

  it('returns {kind:"range"} for bytes=0- (full file from 0)', () => {
    const result = parseRangeHeader('bytes=0-', SIZE);
    expect(result).toEqual({ kind: 'range', start: 0, end: SIZE - 1 });
  });

  it('returns {kind:"invalid"} when start exceeds file size (bytes=999-, size=500)', () => {
    const result = parseRangeHeader('bytes=999-', 500);
    expect(result).toEqual({ kind: 'invalid' });
  });

  it('returns {kind:"invalid"} when Range header is malformed (bytes=abc)', () => {
    const result = parseRangeHeader('bytes=abc', SIZE);
    expect(result).toEqual({ kind: 'invalid' });
  });

  it('returns {kind:"invalid"} when Range header has no bytes= prefix', () => {
    const result = parseRangeHeader('cats=0-99', SIZE);
    expect(result).toEqual({ kind: 'invalid' });
  });

  it('returns {kind:"invalid"} when start > end', () => {
    const result = parseRangeHeader('bytes=200-100', SIZE);
    expect(result).toEqual({ kind: 'invalid' });
  });

  it('returns {kind:"invalid"} when end equals fileSize (exclusive), valid range is 0..fileSize-1', () => {
    // bytes=0-1000 would be byte 1000 which is beyond fileSize=1000
    // But let's keep: end can be fileSize-1 max, so 1000 >= fileSize = invalid
    const result = parseRangeHeader('bytes=0-1000', SIZE);
    expect(result).toEqual({ kind: 'invalid' });
  });
});

describe('formatContentRange', () => {
  it('formats a content-range header correctly', () => {
    const result = formatContentRange({ start: 0, end: 99 }, 1024);
    expect(result).toBe('bytes 0-99/1024');
  });

  it('formats with mid-range values', () => {
    const result = formatContentRange({ start: 500, end: 999 }, 2000);
    expect(result).toBe('bytes 500-999/2000');
  });
});