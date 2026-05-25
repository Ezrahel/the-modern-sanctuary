import { createHmac, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getCockroachDbUrl, normalizeEnvValue } from './env';

export const ADMIN_SESSION_COOKIE = 'sanctuary_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type CookieResponse = {
  setHeader(name: string, value: string | string[]): void;
};

type CookieRequest = {
  headers: Record<string, string | string[] | undefined>;
};

export function getAdminEmail(): string | undefined {
  return normalizeEnvValue(process.env.ADMIN_EMAIL)?.toLowerCase();
}

export function getAdminPasswordHash(): string | undefined {
  return normalizeEnvValue(process.env.ADMIN_PASSWORD_HASH);
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(getAdminEmail() && getAdminPasswordHash());
}

function getAdminSessionSecret(): string {
  return (
    normalizeEnvValue(process.env.ADMIN_SESSION_SECRET) ||
    getCockroachDbUrl()?.slice(0, 48) ||
    'sanctuary-dev-session-secret-change-me'
  );
}

export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const adminEmail = getAdminEmail();
  const passwordHash = getAdminPasswordHash();
  if (!adminEmail || !passwordHash) return false;
  if (email.trim().toLowerCase() !== adminEmail) return false;
  return bcrypt.compare(password, passwordHash);
}

function parseCookies(headerValue: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!headerValue) return cookies;
  for (const part of headerValue.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rawValueParts.join('=') || '');
  }
  return cookies;
}

export function getAdminSessionToken(req: CookieRequest): string | undefined {
  const cookieHeader = Array.isArray(req.headers.cookie) ? req.headers.cookie.join('; ') : req.headers.cookie;
  return parseCookies(cookieHeader)[ADMIN_SESSION_COOKIE];
}

export function signAdminSession(email: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${email}|${exp}`;
  const signature = createHmac('sha256', getAdminSessionSecret()).update(payload).digest('hex');
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${signature}`;
}

export function verifyAdminSession(token: string | undefined): { email: string } | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expectedSignature = createHmac('sha256', getAdminSessionSecret()).update(payload).digest('hex');
  const provided = Buffer.from(signature, 'hex');
  const expected = Buffer.from(expectedSignature, 'hex');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  const [email, expRaw] = payload.split('|');
  const exp = Number(expRaw);
  if (!email || !Number.isFinite(exp) || exp < Date.now()) return null;

  const adminEmail = getAdminEmail();
  if (!adminEmail || email.toLowerCase() !== adminEmail) return null;

  return { email };
}

export function setAdminSessionCookie(res: CookieResponse, token: string) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=28800',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAdminSessionCookie(res: CookieResponse) {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function requireAdmin(req: CookieRequest): { email: string } | null {
  if (!isAdminAuthConfigured()) return null;
  return verifyAdminSession(getAdminSessionToken(req));
}
