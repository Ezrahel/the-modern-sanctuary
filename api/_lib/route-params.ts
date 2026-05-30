import type { VercelRequest } from '@vercel/node';

/** Resolve `id` from Vercel dynamic routes (`req.query.id`) or the request path. */
export function getBookIdFromRequest(req: VercelRequest): string | null {
  const fromQuery = req.query?.id;
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string' && fromQuery[0].trim()) {
    return fromQuery[0].trim();
  }

  const rawUrl = req.url || '';
  const pathname = rawUrl.startsWith('http')
    ? new URL(rawUrl).pathname
    : rawUrl.split('?')[0];

  const segments = pathname.split('/').filter(Boolean);
  const booksIdx = segments.indexOf('books');
  if (booksIdx >= 0 && segments[booksIdx + 1]) {
    return segments[booksIdx + 1];
  }

  return null;
}
