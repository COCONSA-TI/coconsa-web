import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}
const secretKey: string = process.env.JWT_SECRET;
const key = new TextEncoder().encode(secretKey);

/**
 * In-memory token revocation list (blacklist by JTI).
 *
 * NOTE: This works correctly for single-instance deployments.
 * For multi-instance / serverless deployments, replace with a
 * shared store such as Redis / Upstash so that a token revoked
 * on one instance is also rejected on all others.
 *
 * Each entry stores the JTI and its expiry time so that expired
 * entries can be pruned automatically, keeping memory bounded.
 */
const revokedTokens = new Map<string, number>(); // jti → expiry epoch ms

function pruneRevokedTokens() {
  const now = Date.now();
  for (const [jti, expiresAt] of revokedTokens) {
    if (expiresAt < now) {
      revokedTokens.delete(jti);
    }
  }
}

export function revokeToken(jti: string, expiresAt: Date) {
  pruneRevokedTokens();
  revokedTokens.set(jti, expiresAt.getTime());
}

export function isTokenRevoked(jti: string): boolean {
  return revokedTokens.has(jti);
}

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  role?: string;
  expiresAt: string | Date;
  // jti is inherited from JWTPayload (string | undefined)
}

export async function encrypt(payload: Omit<SessionPayload, keyof JWTPayload>) {
  const jti = crypto.randomUUID();
  return await new SignJWT({ ...(payload as unknown as JWTPayload), jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setJti(jti)
    .setExpirationTime('24h')
    .sign(key);
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    // Reject tokens that have been explicitly revoked (e.g. after logout)
    if (payload.jti && isTokenRevoked(payload.jti)) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, email: string, role?: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
  const session = await encrypt({ userId, email, role, expiresAt });
  
  (await cookies()).set('session', session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'strict',
    path: '/',
  });
  
  return session;
}

export async function getSession() {
  const session = (await cookies()).get('session')?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function deleteSession() {
  // Revoke the current token so it cannot be reused even if someone
  // has captured it (e.g. via XSS before the cookie is cleared).
  const token = (await cookies()).get('session')?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      if (payload.jti) {
        const expiresAt = payload.exp
          ? new Date(payload.exp * 1000)
          : new Date(Date.now() + 24 * 60 * 60 * 1000);
        revokeToken(payload.jti, expiresAt);
      }
    } catch {
      // Token already invalid — nothing to revoke
    }
  }
  (await cookies()).delete('session');
}
