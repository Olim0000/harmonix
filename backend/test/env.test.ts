import { describe, it, expect } from 'vitest';
import { validateJwtSecret, validateRole } from '@/env.js';

describe('validateJwtSecret()', () => {
  it('throws for known default "change-me-in-production"', () => {
    expect(() => validateJwtSecret('change-me-in-production')).toThrow(
      'JWT_SECRET is a known default'
    );
  });

  it('throws for known default "your-super-secret-jwt-secret-min-32-chars"', () => {
    expect(() => validateJwtSecret('your-super-secret-jwt-secret-min-32-chars')).toThrow(
      'JWT_SECRET is a known default'
    );
  });

  it('throws for known default "supersecretkey123"', () => {
    expect(() => validateJwtSecret('supersecretkey123')).toThrow(
      'JWT_SECRET is a known default'
    );
  });

  it('throws for known default "supersecret"', () => {
    expect(() => validateJwtSecret('supersecret')).toThrow(
      'JWT_SECRET is a known default'
    );
  });

  it('throws for short secret (< 32 chars)', () => {
    expect(() => validateJwtSecret('short')).toThrow(
      'JWT_SECRET must be set to a secure random string'
    );
  });

  it('does not throw for a valid 32+ char secret', () => {
    expect(() => validateJwtSecret('a-valid-custom-secret-that-is-32-chars!!')).not.toThrow();
  });
});

describe('validateRole()', () => {
  it('throws for invalid role value', () => {
    expect(() => validateRole('invalid')).toThrow(
      'ROLE must be "source" or "player"'
    );
  });

  it('does not throw for "source"', () => {
    expect(() => validateRole('source')).not.toThrow();
  });

  it('does not throw for "player"', () => {
    expect(() => validateRole('player')).not.toThrow();
  });
});
