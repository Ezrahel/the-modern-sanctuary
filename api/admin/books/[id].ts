import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../../_lib/auth';
import { BOOK_LIST_COLUMNS, mapBookRow, sanitizeBookInput, parseModerationStatus } from '../../../_lib/book-fields';
import { ensureDbInitialized } from '../../../_lib/db';
import { applyCors, handleOptions } from '../../../_lib/http';
import { MODERATION_STATUS, isModerationStatus } from '../../../_lib/moderation';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

  const id = req.query.id as string || req.url?.split('/').filter(Boolean).pop() || '';

  if (req.method === 'GET') {
    const result = await db.query(`SELECT ${BOOK_LIST_COLUMNS} FROM books WHERE id = $1 LIMIT 1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Book not found' });
    return res.status(200).json(mapBookRow(result.rows[0]));
  }

  if (req.method === 'PATCH') {
    const input = sanitizeBookInput(req.body || {});
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
      [id, input.title || null, input.author || null, input.category || null,
       input.description || null, input.rating ?? null, input.pages ?? null,
       input.format || null, input.cover || null, input.uploader || null,
       moderationStatus || null,
       input.moderationNote != null ? String(input.moderationNote) : null, admin.email]
    );
    return res.status(200).json(mapBookRow(result.rows[0]));
  }

  if (req.method === 'DELETE') {
    const result = await db.query(`DELETE FROM books WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Book not found' });
    return res.status(200).json({ ok: true, id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
