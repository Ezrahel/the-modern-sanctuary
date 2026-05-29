import { buildApiUrl } from './api';

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export type AdminBook = {
  id: string;
  title: string;
  author: string;
  category: string;
  cover?: string;
  rating?: number;
  pages?: number;
  format?: string;
  uploader?: string;
  description?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  date_added?: string;
  moderation_status?: ModerationStatus;
  moderation_note?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  has_file?: boolean;
};

/** Read the XSRF-TOKEN cookie so we can echo it back in the header. */
function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function parseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export async function adminLogin(email: string, password: string) {
  return parseJson(
    await fetch(buildApiUrl('/api/admin/login'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-xsrf-token': getCsrfToken(),
      },
      body: JSON.stringify({ email, password }),
    })
  );
}

export async function adminLogout() {
  return parseJson(
    await fetch(buildApiUrl('/api/admin/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-xsrf-token': getCsrfToken(),
      },
    })
  );
}

export async function adminSession() {
  const data = await parseJson(
    await fetch(buildApiUrl('/api/admin/session'), {
      credentials: 'include',
    })
  );
  return data as { authenticated: boolean; configured: boolean; email?: string };
}

export async function fetchAdminBooks(params: {
  status?: string;
  query?: string;
  page?: number;
}) {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.query) search.set('query', params.query);
  if (params.page) search.set('page', String(params.page));

  const data = await parseJson(
    await fetch(buildApiUrl(`/api/admin/books?${search}`), {
      credentials: 'include',
    })
  );
  return data as { books: AdminBook[]; total: number; page: number; totalPages: number };
}

export async function moderateBook(id: string, action: 'approve' | 'reject', note?: string) {
  return parseJson(
    await fetch(buildApiUrl(`/api/admin/books/${id}/moderate`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-xsrf-token': getCsrfToken(),
      },
      body: JSON.stringify({ action, note }),
    })
  );
}

export async function updateAdminBook(id: string, payload: Record<string, unknown>) {
  return parseJson(
    await fetch(buildApiUrl(`/api/admin/books/${id}`), {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-xsrf-token': getCsrfToken(),
      },
      body: JSON.stringify(payload),
    })
  );
}

export async function deleteAdminBook(id: string) {
  return parseJson(
    await fetch(buildApiUrl(`/api/admin/books/${id}`), {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'x-xsrf-token': getCsrfToken(),
      },
    })
  );
}

