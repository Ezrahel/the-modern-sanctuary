import { ensureDbInitialized } from '../../_lib/db';
import { applyCors, ensureCsrfCookie, handleOptions } from '../../_lib/http';

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);
  ensureCsrfCookie(req, res);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const db = await ensureDbInitialized().catch((error) => {
    console.error('Failed to initialize database:', error);
    return null;
  });

  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable or failed to initialize' });
  }

  try {
    const id = String(req.query?.id || '');
    const result = await db.query(
      `SELECT id, title, format, file_name, file_type, file_size, file_data, file_data IS NOT NULL AS has_file
       FROM books
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (!result.rows[0].file_data) {
      return res.status(404).json({ error: 'No uploaded file found for this book' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Failed to fetch book file:', error);
    return res.status(500).json({ error: 'Failed to fetch book file' });
  }
}
