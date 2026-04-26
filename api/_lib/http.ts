import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-xsrf-token';

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
};

type ResponseLike = {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): ResponseLike;
  json(payload: unknown): void;
  end(body?: string): void;
};

export function applyCors(req: RequestLike, res: ResponseLike) {
  const allowedOrigin = process.env.APP_URL?.trim();
  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;

  if (allowedOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-xsrf-token');
    res.setHeader('Vary', 'Origin');
  }
}

export function handleOptions(req: RequestLike, res: ResponseLike) {
  if (req.method === 'OPTIONS') {
    applyCors(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}

function parseCookies(headerValue: string | undefined) {
  const cookies: Record<string, string> = {};
  if (!headerValue) return cookies;

  for (const part of headerValue.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rawValueParts.join('=') || '');
  }

  return cookies;
}

export function ensureCsrfCookie(req: RequestLike, res: ResponseLike) {
  const cookieHeader = Array.isArray(req.headers.cookie) ? req.headers.cookie.join('; ') : req.headers.cookie;
  const cookies = parseCookies(cookieHeader);
  const existing = cookies[CSRF_COOKIE_NAME];

  if (existing) return existing;

  const token = crypto.randomBytes(32).toString('hex');
  const isCrossOriginDeployment = Boolean(process.env.APP_URL?.trim());
  const cookieParts = [
    `${CSRF_COOKIE_NAME}=${token}`,
    'Path=/',
    isCrossOriginDeployment ? 'SameSite=None' : 'SameSite=Lax',
  ];

  if (process.env.NODE_ENV === 'production' || isCrossOriginDeployment) {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
  return token;
}

export function verifyCsrf(req: RequestLike) {
  const cookieHeader = Array.isArray(req.headers.cookie) ? req.headers.cookie.join('; ') : req.headers.cookie;
  const cookies = parseCookies(cookieHeader);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];
  const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  return Boolean(cookieToken && token && cookieToken === token);
}
