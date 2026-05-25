import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../_lib/auth';
import { BOOK_LIST_COLUMNS, mapBookRow, parseModerationStatus, sanitizeBookInput } from '../_lib/book-fields';
import { ensureDbInitialized, MAX_UPLOAD_BYTES } from '../_lib/db';
import { applyCors, handleOptions } from '../_lib/http';
import { MODERATION_STATUS, isModerationStatus } from '../_lib/moderation';

export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
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

  if (req.method === 'GET') {
    const status = String(req.query.status || 'all').toLowerCase();
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 100);
    const offset = (page - 1) * limit;
    const query = String(req.query.query || '').trim();

    let whereClause = ' WHERE 1=1';
    const params: string[] = [];

    if (status !== 'all') {
      if (!isModerationStatus(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      params.push(status);
      whereClause += ` AND moderation_status = $${params.length}`;
    }

    if (query) {
      params.push(`%${query}%`);
      const qIdx = params.length;
      whereClause += ` AND (title ILIKE $${qIdx} OR author ILIKE $${qIdx} OR uploader ILIKE $${qIdx})`;
    }

    const countResult = await db.query(`SELECT COUNT(*) FROM books${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);
    const listParams = [...params, String(limit), String(offset)];
    const result = await db.query(
      `SELECT ${BOOK_LIST_COLUMNS} FROM books${whereClause} ORDER BY date_added DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    return res.status(200).json({
      books: result.rows.map(mapBookRow),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  }

  if (req.method === 'POST') {
    const input = sanitizeBookInput(req.body || {});
    if (!input.title || !input.author || !input.category || !input.description) {
      return res.status(400).json({ error: 'Title, author, category, and description are required' });
    }

    const ratingNum = input.rating ?? 5;
    const pagesNum = input.pages ?? 100;
    const moderationStatus = parseModerationStatus(input.moderationStatus, MODERATION_STATUS.APPROVED);

    if (input.fileData) {
      if (!input.fileData.startsWith('data:')) {
        return res.status(400).json({ error: 'Invalid book file payload' });
      }
      const fileSizeNum = input.fileSize ?? 0;
      if (fileSizeNum < 1 || fileSizeNum > MAX_UPLOAD_BYTES) {
        return res.status(400).json({ error: 'Book file must be 3MB or smaller' });
      }

      const result = await db.query(
        `INSERT INTO books (
          title, author, category, description, rating, pages, format, cover, uploader,
          file_name, file_type, file_size, file_data, moderation_status, moderation_note, reviewed_at, reviewed_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now(),$16)
        RETURNING ${BOOK_LIST_COLUMNS}`,
        [
          input.title,
          input.author,
          input.category,
          input.description,
          ratingNum,
          pagesNum,
          input.format,
          input.cover || '/Sacred+Rhythms.png',
          input.uploader,
          input.fileName,
          input.fileType,
          fileSizeNum,
          input.fileData,
          moderationStatus,
          input.moderationNote ? String(input.moderationNote) : null,
          admin.email,
        ]
      );
      return res.status(201).json(mapBookRow(result.rows[0]));
    }

    const result = await db.query(
      `INSERT INTO books (
        title, author, category, description, rating, pages, format, cover, uploader,
        moderation_status, moderation_note, reviewed_at, reviewed_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12)
      RETURNING ${BOOK_LIST_COLUMNS}`,
      [
        input.title,
        input.author,
        input.category,
        input.description,
        ratingNum,
        pagesNum,
        input.format,
        input.cover || '/Sacred+Rhythms.png',
        input.uploader,
        moderationStatus,
        input.moderationNote ? String(input.moderationNote) : null,
        admin.email,
      ]
    );
    return res.status(201).json(mapBookRow(result.rows[0]));
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
