import xss from 'xss';
import { ensureDbInitialized } from './_lib/db';
import { applyCors, ensureCsrfCookie, handleOptions, verifyCsrf } from './_lib/http';

export default async function handler(req: any, res: any) {
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
      const sql = `SELECT * FROM books${whereClause} ORDER BY ${orderBy} LIMIT ${limitNum} OFFSET ${offset}`;
      const result = await db.query(sql, params);

      return res.status(200).json({
        books: result.rows,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      console.error('Search failed:', error);
      return res.status(500).json({ error: 'Search failed' });
    }
  }

  if (req.method === 'POST') {
    if (!verifyCsrf(req)) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    let { title, author, category, description, rating, pages, format, cover, uploader } = req.body || {};

    if (!title || !author || !category || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ratingNum = parseFloat(String(rating));
    const pagesNum = parseInt(String(pages), 10);

    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (Number.isNaN(pagesNum) || pagesNum < 1) {
      return res.status(400).json({ error: 'Pages must be at least 1' });
    }

    title = xss(String(title));
    author = xss(String(author));
    category = xss(String(category));
    description = xss(String(description));
    format = xss(String(format || ''));
    cover = xss(String(cover || ''));
    uploader = xss(String(uploader || 'Community User'));

    try {
      const result = await db.query(
        `INSERT INTO books (title, author, category, description, rating, pages, format, cover, uploader)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [title, author, category, description, ratingNum, pagesNum, format, cover, uploader]
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Failed to upload book:', error);
      return res.status(500).json({ error: 'Failed to upload book' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
