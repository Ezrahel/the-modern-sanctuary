import xss from 'xss';
import { ensureDbInitialized } from './_lib/db';
import { applyCors, ensureCsrfCookie, handleOptions, verifyCsrf } from './_lib/http';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  try {
    if (handleOptions(req, res)) return;
    applyCors(req, res);
    ensureCsrfCookie(req, res);

    const db = await ensureDbInitialized().catch((error) => {
      console.error('Failed to initialize database:', error);
      return null;
    });

    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    if (req.method === 'GET') {
      const { query, category, format, sortBy, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(String(page), 10) || 1;
      const limitNum = parseInt(String(limit), 10) || 50;
      const offset = (pageNum - 1) * limitNum;

      let whereClause = ' WHERE 1=1';
      const params: string[] = [];

      let orderBy = 'date_added DESC';
      if (query) {
        params.push(String(query));
        const qIdx = params.length;
        whereClause += ` AND (
          search_vector @@ websearch_to_tsquery('english', $${qIdx})
          OR title ILIKE '%' || $${qIdx} || '%'
          OR author ILIKE '%' || $${qIdx} || '%'
          OR similarity(title, $${qIdx}) > 0.2
          OR similarity(author, $${qIdx}) > 0.2
        )`;

        if (!sortBy || sortBy === 'newest') {
          orderBy = `ts_rank(search_vector, websearch_to_tsquery('english', $${qIdx})) DESC, similarity(title, $${qIdx}) DESC`;
        }
      }

      if (category && category !== 'All') {
        params.push(String(category));
        whereClause += ` AND category = $${params.length}`;
      }

      if (format && format !== 'All') {
        params.push(String(format));
        whereClause += ` AND format ILIKE '%' || $${params.length} || '%'`;
      }

      if (sortBy === 'newest' && !query) orderBy = 'date_added DESC';
      else if (sortBy === 'title') orderBy = 'title ASC';
      else if (sortBy === 'author') orderBy = 'author ASC';
      else if (sortBy === 'rating') orderBy = 'rating DESC';
      else if (sortBy === 'oldest') orderBy = 'date_added ASC';

      try {
        const countResult = await db.query(`SELECT COUNT(*) FROM books${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count, 10);
        const sql = `SELECT id, title, author, category, cover, rating, pages, format, uploader, description, file_name, file_type, file_size, date_added, file_data IS NOT NULL AS has_file FROM books${whereClause} ORDER BY ${orderBy} LIMIT ${limitNum} OFFSET ${offset}`;
        const result = await db.query(sql, params);

        return res.status(200).json({
          books: result.rows,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
        });
      } catch (error: any) {
        console.error('Search failed:', error);
        return res.status(500).json({ 
          error: 'Search failed',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }

    if (req.method === 'POST') {
      if (!verifyCsrf(req)) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
      }

      let { title, author, category, description, rating, pages, format, cover, uploader, fileName, fileType, fileSize, fileData } = req.body || {};

      if (!title || !author || !category || !description || !fileName || !fileData) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const ratingNum = parseFloat(String(rating));
      const pagesNum = parseInt(String(pages), 10);
      const fileSizeNum = parseInt(String(fileSize), 10);

      if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      if (Number.isNaN(pagesNum) || pagesNum < 1) {
        return res.status(400).json({ error: 'Pages must be at least 1' });
      }

      if (Number.isNaN(fileSizeNum) || fileSizeNum < 1 || fileSizeNum > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'Book file must be 10MB or smaller' });
      }

      title = xss(String(title));
      author = xss(String(author));
      category = xss(String(category));
      description = xss(String(description));
      format = xss(String(format || ''));
      cover = xss(String(cover || ''));
      uploader = xss(String(uploader || 'Community User'));
      fileName = xss(String(fileName));
      fileType = xss(String(fileType || 'application/octet-stream'));
      fileData = String(fileData);

      if (!fileData.startsWith('data:')) {
        return res.status(400).json({ error: 'Invalid book file payload' });
      }

      try {
        const result = await db.query(
          `INSERT INTO books (title, author, category, description, rating, pages, format, cover, uploader, file_name, file_type, file_size, file_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [title, author, category, description, ratingNum, pagesNum, format, cover, uploader, fileName, fileType, fileSizeNum, fileData]
        );

        return res.status(201).json(result.rows[0]);
      } catch (error: any) {
        console.error('Failed to upload book:', {
          message: error.message,
          stack: error.stack,
          title: title?.substring(0, 50),
          author: author?.substring(0, 50),
          fileSize: fileSizeNum,
          fileType: fileType,
          fileDataLength: fileData?.length,
        });
        return res.status(500).json({ 
          error: 'Failed to upload book',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (globalError: any) {
    console.error('CRITICAL: API Handler Crash:', {
      message: globalError.message,
      stack: globalError.stack,
      method: req.method,
      url: req.url,
    });
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: globalError.message 
    });
  }
}
