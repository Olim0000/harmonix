import { describe, it, expect, beforeAll } from 'vitest';
import { signToken, verifyToken } from '@/jwt.js';

/**
 * JWT tests verify the signature-only token mechanism.
 * CRITICAL: These tests must NOT open any database — the verify function
 * uses jose which is signature-only (no DB lookup).
 */

// A unique secret for testing (not the one from env for wrong-secret test)
const WRONG_SECRET = 'this-is-a-different-secret-that-is-long-enough-32';

describe('JWT sign and verify round trip', () => {
  it('signs and verifies a valid token', async () => {
    const payload = { sub: '1', role: 'user' as const };
    const token = await signToken(payload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

    const decoded = await verifyToken(token);
    expect(decoded.sub).toBe('1');
    expect(decoded.role).toBe('user');
  });

  it('preserves sub and role claims after round trip', async () => {
    const token = await signToken({ sub: '42', role: 'admin' as const });
    const decoded = await verifyToken(token);
    expect(decoded.sub).toBe('42');
    expect(decoded.role).toBe('admin');
  });

  it('includes standard claims: iat, exp, iss, aud', async () => {
    const token = await signToken({ sub: '1', role: 'user' as const });
    const decoded = await verifyToken(token);
    expect(decoded.iat).toBeDefined();
    expect(typeof decoded.iat).toBe('number');
    expect(decoded.exp).toBeDefined();
    expect(typeof decoded.exp).toBe('number');
    expect(decoded.iss).toBe('harmonix');
    expect(decoded.aud).toBe('harmonix');
  });

  it('exp is ~15 minutes from iat', async () => {
    const token = await signToken({ sub: '1', role: 'user' as const });
    const decoded = await verifyToken(token);
    const diff = (decoded.exp as number) - (decoded.iat as number);
    // 15 min = 900 seconds, allow small tolerance
    expect(diff).toBeGreaterThanOrEqual(899);
    expect(diff).toBeLessThanOrEqual(901);
  });
});

describe('JWT verification failures', () => {
  it('fails verification with wrong secret', async () => {
    const token = await signToken({ sub: '1', role: 'user' as const });
    // Re-create verifyToken with wrong secret for this test
    // We import the module function which uses env.jwtSecret
    await expect(verifyToken(token)).resolves.toBeTruthy(); // correct secret passes

    // Manually verify with wrong secret
    const { jwtVerify } = await import('jose');
    const wrongSecret = new TextEncoder().encode(WRONG_SECRET);
    await expect(
      jwtVerify(token, wrongSecret, { issuer: 'harmonix', audience: 'harmonix' })
    ).rejects.toThrow();
  });

  it('fails with tampered token', async () => {
    const token = await signToken({ sub: '1', role: 'user' as const });
    const parts = token.split('.');
    // Tamper with the payload
    const tampered = parts[0] + '.' + parts[1] + 'tampered.' + parts[2];
    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  it('fails with malformed token string', async () => {
    await expect(verifyToken('not-a-jwt')).rejects.toThrow();
  });

  it('fails with empty string', async () => {
    await expect(verifyToken('')).rejects.toThrow();
  });
});

describe('extractToken', () => {
  it('extracts token from valid Bearer header', async () => {
    const { extractToken } = await import('@/jwt.js');
    const token = 'some.jwt.token';
    expect(extractToken(`Bearer ${token}`)).toBe(token);
  });

  it('returns null for undefined header', async () => {
    const { extractToken } = await import('@/jwt.js');
    expect(extractToken(undefined)).toBeNull();
  });

  it('returns null for non-Bearer schemes', async () => {
    const { extractToken } = await import('@/jwt.js');
    expect(extractToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null for malformed Bearer header', async () => {
    const { extractToken } = await import('@/jwt.js');
    expect(extractToken('Bearer')).toBeNull();
  });
});
