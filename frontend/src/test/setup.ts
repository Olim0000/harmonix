/**
 * Test setup — vitest global mocks.
 */
import { vi } from 'vitest';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (index: number) => Object.keys(store)[index] ?? null,
});

// Mock window.location
const location: Record<string, string> = { href: '' };
vi.stubGlobal('location', location);

// Mock window with writable location.href
const windowMock = {
  location: { href: '' },
};
Object.defineProperty(windowMock.location, 'href', {
  set(value: string) { location.href = value; },
  get() { return location.href; },
  configurable: true,
});
vi.stubGlobal('window', windowMock);
