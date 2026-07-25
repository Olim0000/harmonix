import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from './env.js';

const secret = new TextEncoder().encode(env.jwtSecret);
const issuer = 'harmonix';
const audience = 'harmonix';

export interface TokenPayload extends JWTPayload {
  sub: string;
  role: 'admin' | 'user';
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret, {
    issuer,
    audience
  });
  return payload as TokenPayload;
}

export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}