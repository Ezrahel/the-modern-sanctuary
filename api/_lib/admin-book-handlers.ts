import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from './auth';
import { BOOK_LIST_COLUMNS, mapBookRow, sanitizeBookInput, parseModerationStatus } from './book-fields';
import { ensureDbInitialized } from './db';
import { MODERATION_STATUS, isModerationStatus } from './moderation';
import { getBookIdFromRequest } from './route-params';

export async function handleAdminModerateBook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const id = getBookIdFromRequest(req);
  if (!id) {
    return res.status(400).json({ error: 'Book id is required' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

  const action = String(req.body?.action || '').toLowerCase();
  const note = req.body?.note ? String(req.body.note).slice(0, 2000) : null;

  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'action must be approve or reject' });
  }

  const moderationStatus =
    action === 'approve' ? MODERATION_STATUS.APPROVED : MODERATION_STATUS.REJECTED;

  try {
    const result = await db.query(
      `UPDATE books SET moderation_status = $2, moderation_note = $3, reviewed_at = now(), reviewed_by = $4
       WHERE id = $1 RETURNING ${BOOK_LIST_COLUMNS}`,
      [id, moderationStatus, note, admin.email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    return res.status(200).json(mapBookRow(result.rows[0]));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to moderate book';
    console.error('[Admin Moderate Error]', message);
    return res.status(500).json({ error: 'Failed to moderate book' });
  }
}

export async function handleAdminBookFile(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const id = getBookIdFromRequest(req);
  if (!id) {
    return res.status(400).json({ error: 'Book id is required' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

  try {
    const result = await db.query(
      `SELECT id, title, format, file_name, file_type, file_size, file_data, moderation_status
       FROM books WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (!result.rows[0].file_data) {
      return res.status(404).json({ error: 'No file stored for this book' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load book file';
    console.error('[Admin Book File Error]', message);
    return res.status(500).json({ error: 'Failed to load book file' });
  }
}

export async function handleAdminBookById(req: VercelRequest, res: VercelResponse) {
  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const id = getBookIdFromRequest(req);
  if (!id) {
    return res.status(400).json({ error: 'Book id is required' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

  if (req.method === 'GET') {
    try {
      const result = await db.query(`SELECT ${BOOK_LIST_COLUMNS} FROM books WHERE id = $1 LIMIT 1`, [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Book not found' });
      return res.status(200).json(mapBookRow(result.rows[0]));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch book';
      console.error('[Admin Book Get Error]', message);
      return res.status(500).json({ error: 'Failed to fetch book' });
    }
  }

  if (req.method === 'PATCH') {
    const input = sanitizeBookInput(req.body || {});

    try {
      const existing = await db.query(`SELECT id FROM books WHERE id = $1 LIMIT 1`, [id]);
      if (existing.rowCount === 0) return res.status(404).json({ error: 'Book not found' });

      const moderationStatus = input.moderationStatus
        ? parseModerationStatus(input.moderationStatus, MODERATION_STATUS.PENDING)
        : undefined;

      const result = await db.query(
        `UPDATE books SET
          title = COALESCE($2, title), author = COALESCE($3, author),
          category = COALESCE($4, category), description = COALESCE($5, description),
          rating = COALESCE($6, rating), pages = COALESCE($7, pages),
          format = COALESCE($8, format), cover = COALESCE($9, cover),
          uploader = COALESCE($10, uploader),
          moderation_status = COALESCE($11, moderation_status),
          moderation_note = COALESCE($12, moderation_note),
          reviewed_at = CASE WHEN $11 IS NOT NULL THEN now() ELSE reviewed_at END,
          reviewed_by = CASE WHEN $11 IS NOT NULL THEN $13 ELSE reviewed_by END
        WHERE id = $1 RETURNING ${BOOK_LIST_COLUMNS}`,
        [
          id,
          input.title || null,
          input.author || null,
          input.category || null,
          input.description || null,
          input.rating ?? null,
          input.pages ?? null,
          input.format || null,
          input.cover || null,
          input.uploader || null,
          moderationStatus || null,
          input.moderationNote != null ? String(input.moderationNote) : null,
          admin.email,
        ]
      );
      return res.status(200).json(mapBookRow(result.rows[0]));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update book';
      console.error('[Admin Book Patch Error]', message);
      return res.status(500).json({ error: 'Failed to update book' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const result = await db.query(`DELETE FROM books WHERE id = $1 RETURNING id`, [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Book not found' });
      return res.status(200).json({ ok: true, id });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete book';
      console.error('[Admin Book Delete Error]', message);
      return res.status(500).json({ error: 'Failed to delete book' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
