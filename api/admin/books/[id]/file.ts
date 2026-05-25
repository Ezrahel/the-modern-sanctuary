import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../../../_lib/auth';
import { ensureDbInitialized } from '../../../_lib/db';
import { applyCors, handleOptions } from '../../../_lib/http';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

  const id = String(req.query.id || '');
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
}
