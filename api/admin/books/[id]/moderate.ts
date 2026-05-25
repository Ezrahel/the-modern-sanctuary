import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../../_lib/auth';
import { BOOK_LIST_COLUMNS, mapBookRow } from '../../../_lib/book-fields';
import { ensureDbInitialized } from '../../../_lib/db';
import { applyCors, handleOptions } from '../../../_lib/http';
import { MODERATION_STATUS } from '../../../_lib/moderation';

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

  const id = String(req.query.id || '');
  const action = String(req.body?.action || '').toLowerCase();
  const note = req.body?.note ? String(req.body.note).slice(0, 2000) : null;

  if (!id) {
    return res.status(400).json({ error: 'Book id is required' });
  }

  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'action must be approve or reject' });
  }

  const moderationStatus = action === 'approve' ? MODERATION_STATUS.APPROVED : MODERATION_STATUS.REJECTED;

  const result = await db.query(
    `UPDATE books SET
      moderation_status = $2,
      moderation_note = $3,
      reviewed_at = now(),
      reviewed_by = $4
    WHERE id = $1
    RETURNING ${BOOK_LIST_COLUMNS}`,
    [id, moderationStatus, note, admin.email]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Book not found' });
  }

  return res.status(200).json(mapBookRow(result.rows[0]));
}
