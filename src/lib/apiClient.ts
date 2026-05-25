import { API_BASE_URL } from '../api';

export async function parseApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();

  if (contentType.includes('application/json')) {
    try {
      return rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error('The server returned invalid JSON.');
    }
  }

  if (rawText.trim().startsWith('<!doctype') || rawText.trim().startsWith('<html')) {
    throw new Error(
      window.location.port === '5173'
        ? 'Open the app from http://localhost:3000 (Express API), not the Vite-only port.'
        : API_BASE_URL
          ? `API at ${API_BASE_URL} returned HTML instead of JSON. Check /api routing on your host.`
          : 'The server returned HTML instead of API JSON.'
    );
  }

  return rawText;
}

export async function fetchCsrfToken(): Promise<string | null> {
  const { buildApiUrl } = await import('../api');
  const res = await fetch(buildApiUrl('/api/csrf-token'), { credentials: 'include' });
  if (!res.ok) return null;
  const data = await parseApiResponse(res);
  return data?.token ?? null;
}

export function getExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

export function isAllowedBookExtension(fileName: string) {
  return ['pdf', 'epub', 'mobi', 'doc', 'docx'].includes(getExtension(fileName));
}

/** Run async tasks with limited concurrency. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}
