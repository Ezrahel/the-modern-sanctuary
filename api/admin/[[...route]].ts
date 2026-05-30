import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isAdminAuthConfigured,
  requireAdmin,
  setAdminSessionCookie,
  signAdminSession,
  verifyAdminCredentials,
  clearAdminSessionCookie,
} from '../_lib/auth';
import {
  handleAdminBookById,
  handleAdminBookFile,
  handleAdminModerateBook,
} from '../_lib/admin-book-handlers';
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

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAdminAuthConfigured()) {
    return res.status(503).json({ error: 'Admin login is not configured on the server' });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const valid = await verifyAdminCredentials(String(email), String(password));
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signAdminSession(String(email).trim().toLowerCase());
  setAdminSessionCookie(res, token);

  return res.status(200).json({
    ok: true,
    email: String(email).trim().toLowerCase(),
  });
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  clearAdminSessionCookie(res);
  return res.status(200).json({ ok: true });
}

async function handleSession(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAdminAuthConfigured()) {
    return res.status(200).json({ authenticated: false, configured: false });
  }

  const admin = requireAdmin(req);
  return res.status(200).json({
    authenticated: Boolean(admin),
    configured: true,
    email: admin?.email,
  });
}

async function handleListBooks(req: VercelRequest, res: VercelResponse) {
  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

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

async function handleCreateBook(req: VercelRequest, res: VercelResponse) {
  const admin = requireAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

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
        input.title, input.author, input.category, input.description,
        ratingNum, pagesNum, input.format, input.cover || '/Sacred+Rhythms.png',
        input.uploader, input.fileName, input.fileType, fileSizeNum,
        input.fileData, moderationStatus,
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
      input.title, input.author, input.category, input.description,
      ratingNum, pagesNum, input.format, input.cover || '/Sacred+Rhythms.png',
      input.uploader, moderationStatus,
      input.moderationNote ? String(input.moderationNote) : null,
      admin.email,
    ]
  );
  return res.status(201).json(mapBookRow(result.rows[0]));
}

async function handleAnalytics(req: VercelRequest, res: VercelResponse) {
  const cookieHeader = (Array.isArray(req.headers.cookie) ? req.headers.cookie.join('; ') : req.headers.cookie) || '(none)';
  const admin = requireAdmin(req);
  if (!admin) {
    const hasSessionCookie = cookieHeader.includes('sanctuary_admin_session');
    console.error('Analytics auth failure:', { hasSessionCookie, cookieHeader: cookieHeader.substring(0, 200) });
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

  const { query } = req;
  const mode = String(query.mode || 'summary');

  try {
    if (mode === 'export') {
      const type = String(query.type || 'traffic');
      let csvContent = '';

      if (type === 'books') {
        const result = await db.query(`
          SELECT b.title, b.author, b.category,
                 COUNT(DISTINCT v.id) as views,
                 COUNT(DISTINCT d.id) as downloads
          FROM books b
          LEFT JOIN analytics_book_views v ON v.book_id = b.id
          LEFT JOIN analytics_downloads d ON d.book_id = b.id
          GROUP BY b.id, b.title, b.author, b.category
          ORDER BY downloads DESC, views DESC
        `);

        csvContent = 'Book Title,Author,Category,Views,Downloads\n';
        for (const row of result.rows) {
          const title = `"${row.title.replace(/"/g, '""')}"`;
          const author = `"${row.author.replace(/"/g, '""')}"`;
          const category = `"${row.category.replace(/"/g, '""')}"`;
          csvContent += `${title},${author},${category},${row.views},${row.downloads}\n`;
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="sanctuary_book_analytics.csv"');
        return res.status(200).send(csvContent);
      } else {
        const result = await db.query(`
          SELECT DATE(timestamp) as date, COUNT(*) as pageviews, COUNT(DISTINCT visitor_id) as unique_visitors
          FROM analytics_page_views
          WHERE timestamp >= now() - INTERVAL '30 days'
          GROUP BY DATE(timestamp)
          ORDER BY DATE(timestamp) DESC
        `);

        csvContent = 'Date,Pageviews,Unique Visitors\n';
        for (const row of result.rows) {
          const dateStr = new Date(row.date).toISOString().split('T')[0];
          csvContent += `${dateStr},${row.pageviews},${row.unique_visitors}\n`;
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="sanctuary_traffic_analytics.csv"');
        return res.status(200).send(csvContent);
      }
    }

    if (mode === 'summary') {
      const realTimeRes = await db.query(`
        SELECT COUNT(DISTINCT visitor_id) as active_users
        FROM analytics_sessions
        WHERE last_activity >= now() - INTERVAL '40 seconds'
      `);
      const activeUsers = parseInt(realTimeRes.rows[0].active_users, 10) || 0;

      const trafficTodayRes = await db.query(`
        SELECT COUNT(*) as pageviews, COUNT(DISTINCT visitor_id) as unique_visitors
        FROM analytics_page_views
        WHERE timestamp >= now() - INTERVAL '24 hours'
      `);
      const pageviewsToday = parseInt(trafficTodayRes.rows[0].pageviews, 10) || 0;
      const visitorsToday = parseInt(trafficTodayRes.rows[0].unique_visitors, 10) || 0;

      const trafficYesterdayRes = await db.query(`
        SELECT COUNT(*) as pageviews, COUNT(DISTINCT visitor_id) as unique_visitors
        FROM analytics_page_views
        WHERE timestamp >= now() - INTERVAL '48 hours' AND timestamp < now() - INTERVAL '24 hours'
      `);
      const pageviewsYesterday = parseInt(trafficYesterdayRes.rows[0].pageviews, 10) || 0;
      const visitorsYesterday = parseInt(trafficYesterdayRes.rows[0].unique_visitors, 10) || 0;

      const pageviewsGrowth = pageviewsYesterday > 0 ? ((pageviewsToday - pageviewsYesterday) / pageviewsYesterday) * 100 : 0;
      const visitorsGrowth = visitorsYesterday > 0 ? ((visitorsToday - visitorsYesterday) / visitorsYesterday) * 100 : 0;

      const downloadsTodayRes = await db.query(`
        SELECT COUNT(*) as count FROM analytics_downloads WHERE timestamp >= now() - INTERVAL '24 hours'
      `);
      const downloadsYesterdayRes = await db.query(`
        SELECT COUNT(*) as count FROM analytics_downloads WHERE timestamp >= now() - INTERVAL '48 hours' AND timestamp < now() - INTERVAL '24 hours'
      `);
      const downloadsToday = parseInt(downloadsTodayRes.rows[0].count, 10) || 0;
      const downloadsYesterday = parseInt(downloadsYesterdayRes.rows[0].count, 10) || 0;
      const downloadsGrowth = downloadsYesterday > 0 ? ((downloadsToday - downloadsYesterday) / downloadsYesterday) * 100 : 0;

      const totalVisitorsRes = await db.query(`SELECT COUNT(*) as count FROM analytics_visitors`);
      const totalPageviewsRes = await db.query(`SELECT COUNT(*) as count FROM analytics_page_views`);
      const totalDownloadsRes = await db.query(`SELECT COUNT(*) as count FROM analytics_downloads`);
      const totalBooksRes = await db.query(`SELECT COUNT(*) as count FROM books`);

      const totalUniqueVisitors = parseInt(totalVisitorsRes.rows[0].count, 10) || 0;
      const totalPageviews = parseInt(totalPageviewsRes.rows[0].count, 10) || 0;
      const totalDownloads = parseInt(totalDownloadsRes.rows[0].count, 10) || 0;
      const totalBooks = parseInt(totalBooksRes.rows[0].count, 10) || 0;

      const sessionStatsRes = await db.query(`
        SELECT
          AVG(duration_seconds) as avg_duration,
          (COUNT(CASE WHEN bounce = TRUE THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0)) * 100 as bounce_rate
        FROM analytics_sessions
      `);
      const avgSessionDuration = Math.round(parseFloat(sessionStatsRes.rows[0].avg_duration) || 0);
      const bounceRate = Math.round(parseFloat(sessionStatsRes.rows[0].bounce_rate) || 0);

      const dailyTrendsRes = await db.query(`
        SELECT DATE(timestamp) as date, COUNT(*) as pageviews, COUNT(DISTINCT visitor_id) as uniques
        FROM analytics_page_views
        WHERE timestamp >= now() - INTERVAL '7 days'
        GROUP BY DATE(timestamp)
        ORDER BY DATE(timestamp) ASC
      `);

      const dailyTrends = dailyTrendsRes.rows.map(row => ({
        date: new Date(row.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        pageviews: parseInt(row.pageviews, 10),
        uniques: parseInt(row.uniques, 10),
      }));

      const dailyDownloadsRes = await db.query(`
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM analytics_downloads
        WHERE timestamp >= now() - INTERVAL '7 days'
        GROUP BY DATE(timestamp)
        ORDER BY DATE(timestamp) ASC
      `);

      const dailyDownloads = dailyDownloadsRes.rows.map(row => ({
        date: new Date(row.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        count: parseInt(row.count, 10),
      }));

      const topBooksRes = await db.query(`
        SELECT b.id, b.title, b.author, b.category, b.cover, COUNT(d.id) as downloads
        FROM books b
        JOIN analytics_downloads d ON d.book_id = b.id
        GROUP BY b.id, b.title, b.author, b.category, b.cover
        ORDER BY downloads DESC
        LIMIT 5
      `);

      const topCategoriesRes = await db.query(`
        SELECT b.category, COUNT(v.id) as views
        FROM books b
        JOIN analytics_book_views v ON v.book_id = b.id
        GROUP BY b.category
        ORDER BY views DESC
        LIMIT 5
      `);

      const deviceRes = await db.query(`
        SELECT device_type as name, COUNT(*) as value
        FROM analytics_visitors
        WHERE device_type IS NOT NULL
        GROUP BY device_type
      `);
      const browserRes = await db.query(`
        SELECT browser as name, COUNT(*) as value
        FROM analytics_visitors
        WHERE browser IS NOT NULL
        GROUP BY browser
        ORDER BY value DESC
        LIMIT 4
      `);
      const osRes = await db.query(`
        SELECT os as name, COUNT(*) as value
        FROM analytics_visitors
        WHERE os IS NOT NULL
        GROUP BY os
        ORDER BY value DESC
        LIMIT 4
      `);

      const recentViewsRes = await db.query(`
        SELECT v.timestamp, b.title, b.category, 'view' as type
        FROM analytics_book_views v
        JOIN books b ON v.book_id = b.id
        ORDER BY v.timestamp DESC
        LIMIT 4
      `);

      const recentDownloadsRes = await db.query(`
        SELECT d.timestamp, b.title, b.category, 'download' as type
        FROM analytics_downloads d
        JOIN books b ON d.book_id = b.id
        ORDER BY d.timestamp DESC
        LIMIT 4
      `);

      const liveFeed = [...recentViewsRes.rows, ...recentDownloadsRes.rows]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

      return res.status(200).json({
        summary: {
          activeUsers, visitorsToday, visitorsGrowth,
          pageviewsToday, pageviewsGrowth,
          downloadsToday, downloadsGrowth,
          totalUniqueVisitors, totalPageviews, totalDownloads, totalBooks,
          avgSessionDuration, bounceRate,
        },
        dailyTrends,
        dailyDownloads,
        topBooks: topBooksRes.rows,
        topCategories: topCategoriesRes.rows,
        technology: {
          devices: deviceRes.rows,
          browsers: browserRes.rows,
          os: osRes.rows,
        },
        liveFeed,
      });
    }

    return res.status(400).json({ error: 'Invalid mode parameter' });
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('not found') || msg.includes('permission denied')) {
      console.warn('Analytics tables not ready, returning empty data:', msg);
      return res.status(200).json({
        summary: {
          activeUsers: 0, visitorsToday: 0, visitorsGrowth: 0,
          pageviewsToday: 0, pageviewsGrowth: 0,
          downloadsToday: 0, downloadsGrowth: 0,
          totalUniqueVisitors: 0, totalPageviews: 0, totalDownloads: 0, totalBooks: 0,
          avgSessionDuration: 0, bounceRate: 0,
        },
        dailyTrends: [], dailyDownloads: [],
        topBooks: [], topCategories: [],
        technology: { devices: [], browsers: [], os: [] },
        liveFeed: [],
      });
    }
    console.error('Analytics aggregation error:', msg);
    return res.status(500).json({ error: 'Failed to compile analytics aggregates' });
  }
}

function getPath(req: VercelRequest): string {
  const parsed = new URL(req.url || '/', 'http://localhost');
  return parsed.pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

  const path = getPath(req);
  const segments = path ? path.split('/') : [];

  if (segments.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  const resource = segments[0];

  if (resource === 'login') {
    return handleLogin(req, res);
  }

  if (resource === 'logout') {
    return handleLogout(req, res);
  }

  if (resource === 'session') {
    return handleSession(req, res);
  }

  if (resource === 'analytics') {
    return handleAnalytics(req, res);
  }

  if (resource === 'books') {
    if (segments.length === 1) {
      if (req.method === 'GET') {
        return handleListBooks(req, res);
      }
      if (req.method === 'POST') {
        return handleCreateBook(req, res);
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const bookId = segments[1];
    const subResource = segments[2];
    req.query = { ...req.query, id: bookId };

    if (subResource === 'moderate') {
      return handleAdminModerateBook(req, res);
    }

    if (subResource === 'file') {
      return handleAdminBookFile(req, res);
    }

    if (!subResource) {
      return handleAdminBookById(req, res);
    }

    return res.status(404).json({ error: 'Not found' });
  }

  console.warn('Admin catch-all 404:', { path, segments, resource, url: req.url, method: req.method });
  return res.status(404).json({ error: 'Not found', path, segments, resource, method: req.method });
}
