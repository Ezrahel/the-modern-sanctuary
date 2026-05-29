import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import xss from "xss";
import crypto from "crypto";
import {
  requireAdmin,
  isAdminAuthConfigured,
  verifyAdminCredentials,
  signAdminSession,
  setAdminSessionCookie,
  clearAdminSessionCookie,
} from "./api/_lib/auth";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Lazy initialization of database pool
let pool: pg.Pool | null = null;
let dbConfigErrorLogged = false;

function isValidPostgresUrl(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    return parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
  } catch {
    return false;
  }
}

function getPool() {
  if (!pool) {
    const connectionString = process.env.COCKROACH_DB_URL;
    if (!connectionString) {
      console.warn("COCKROACH_DB_URL is not defined. Database features will be unavailable.");
      return null;
    }

    if (!isValidPostgresUrl(connectionString)) {
      if (!dbConfigErrorLogged) {
        console.warn(
          "COCKROACH_DB_URL is invalid. Expected a full postgres URL like " +
          '"postgresql://username:password@host:26257/database?sslmode=require". ' +
          "Database features will be unavailable until this is fixed."
        );
        dbConfigErrorLogged = true;
      }
      return null;
    }

    try {
      pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false, // For development convenience, but consider stricter settings for production
        },
      });
    } catch (error) {
      if (!dbConfigErrorLogged) {
        console.warn("Failed to configure database pool. Database features will be unavailable.", error);
        dbConfigErrorLogged = true;
      }
      return null;
    }
  }
  return pool;
}

async function initAnalyticsSchema(db: pg.Pool) {
  try {
    console.log('Ensuring CockroachDB-optimized analytics tables and indexes are initialized...');
    
    // 1. Visitors table
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics_visitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_hash STRING UNIQUE NOT NULL,
        first_seen TIMESTAMPTZ DEFAULT now(),
        last_seen TIMESTAMPTZ DEFAULT now(),
        device_type STRING,
        browser STRING,
        os STRING,
        country STRING,
        referrer STRING,
        is_returning BOOLEAN DEFAULT false
      );
    `);

    // 2. Sessions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id UUID REFERENCES analytics_visitors(id) ON DELETE CASCADE,
        session_token STRING UNIQUE NOT NULL,
        started_at TIMESTAMPTZ DEFAULT now(),
        last_activity TIMESTAMPTZ DEFAULT now(),
        duration_seconds INT DEFAULT 0,
        bounce BOOLEAN DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON analytics_sessions(visitor_id);
    `);

    // 3. Page views table
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics_page_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES analytics_sessions(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES analytics_visitors(id) ON DELETE CASCADE,
        path STRING NOT NULL,
        screen_name STRING NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_page_views_session ON analytics_page_views(session_id);
      CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON analytics_page_views(visitor_id);
      CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON analytics_page_views(timestamp DESC);
    `);

    // 4. Book views table
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics_book_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES analytics_sessions(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES analytics_visitors(id) ON DELETE CASCADE,
        book_id UUID REFERENCES books(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_book_views_book ON analytics_book_views(book_id);
      CREATE INDEX IF NOT EXISTS idx_book_views_timestamp ON analytics_book_views(timestamp DESC);
    `);

    // 5. Downloads table
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics_downloads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES analytics_sessions(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES analytics_visitors(id) ON DELETE CASCADE,
        book_id UUID REFERENCES books(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_downloads_book ON analytics_downloads(book_id);
      CREATE INDEX IF NOT EXISTS idx_downloads_timestamp ON analytics_downloads(timestamp DESC);
    `);

    // 6. Events table
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES analytics_sessions(id) ON DELETE CASCADE,
        visitor_id UUID REFERENCES analytics_visitors(id) ON DELETE CASCADE,
        event_type STRING NOT NULL,
        event_data STRING,
        timestamp TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON analytics_events(event_type, timestamp DESC);
    `);

    console.log('Analytics schema initialization complete.');
  } catch (error) {
    console.error('Failed to initialize analytics schemas:', error);
  }
}

async function initDb() {
  const db = getPool();
  if (!db) return;

  try {
    // Direct check: try a simple query on the books table
    try {
      await db.query('SELECT 1 FROM books LIMIT 1');
      
      // Table exists! Do a quick resilient check for missing columns if needed
      await db.query(`
        ALTER TABLE books
        ADD COLUMN IF NOT EXISTS file_name STRING,
        ADD COLUMN IF NOT EXISTS file_type STRING,
        ADD COLUMN IF NOT EXISTS file_size INT,
        ADD COLUMN IF NOT EXISTS file_data STRING,
        ADD COLUMN IF NOT EXISTS moderation_status STRING DEFAULT 'approved',
        ADD COLUMN IF NOT EXISTS moderation_note STRING,
        ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS reviewed_by STRING;
      `).catch(err => console.debug('Optional column check failed (likely already exists):', err.message));
      
      await initAnalyticsSchema(db);
      console.log("Database initialized (schema already exists)");
      return;
    } catch (err) {
      // Table probably doesn't exist, proceed to full initialization
      console.log('Books table not found or inaccessible, starting full initialization...');
    }

    console.log("Initializing database schema for the first time...");
    await db.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`).catch(err => {
      console.warn('Postgres extension pg_trgm could not be created/verified.', err.message);
    });

    await db.query(`
      CREATE TABLE IF NOT EXISTS books (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title STRING NOT NULL,
        author STRING NOT NULL,
        category STRING NOT NULL,
        cover STRING,
        rating FLOAT,
        pages INT,
        format STRING,
        uploader STRING,
        description STRING,
        file_name STRING,
        file_type STRING,
        file_size INT,
        file_data STRING,
        moderation_status STRING DEFAULT 'approved',
        moderation_note STRING,
        reviewed_at TIMESTAMPTZ,
        reviewed_by STRING,
        date_added TIMESTAMPTZ DEFAULT now(),
        search_vector TSVECTOR AS (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(author, '') || ' ' || COALESCE(description, ''))) STORED
      );
      CREATE INDEX IF NOT EXISTS books_search_idx ON books USING GIN (search_vector);
    `);

    // Seed if empty
    console.log("Seeding database with initial books...");
    const initialBooks = [
      { title: 'The Sacred Rhythm: Walking with Christ', author: 'Jonathan P. Silas', category: 'Christian Living', cover: 'https://images.unsplash.com/photo-1519781542704-957ff19eff00?auto=format&fit=crop&q=80&w=800', rating: 4.9, pages: 312, format: 'EPUB, PDF', description: 'A profound exploration of finding sacred rhythm in an age of constant noise.' },
      { title: 'Shadows of Grace', author: 'Marcus V. Sterling', category: 'Theology', cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC691ht-QFxMQmdCpT6PiuCeUSWelsGIJ8A1XvTXNOv-jmHdLsNrHyGYvMX7Iv30VNRLU_2E5kILgysmrICBWYvHT69sQEjFkkOyuZBfGEnlhqcmpEuQqw3HJlHLoFfMHwZ4YFh2tXCQOsEUo0ufISwC67svMl-i__RmamFix5KKOi35kZTG2LPpVAVvc1IsPorV1SVwBLixKKdooH8qO5BpdaGnL8YUkkpzxVfAeMcdXmXuXoPtVKP-Lnhtaa9i0-pI426kJ67NGKE', rating: 4.5, pages: 200, format: 'PDF', description: 'Exploring the depths of grace.' },
      { title: 'The Silent Echo', author: 'Julian Thorne', category: 'Philosophy', cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbxlRAe5A8ImWb9OWEVaTn4JXsf61mC3s3ccVad-Hasyc25nyu9-Nw7UwSr0XdL0b-sXbNKdf4wAaz_WEK7yCJx4amEDLuuSWiHqZzhjguDOJk0jAUcPLDw6S4BkygaYYr_O0TuZdFikkg9U4VwlxMNtlVQhtS6eK7MnH9XlqmrzFJHOtTCYwzA3EQsnlrKEB4tUjpeDnLeYpvFb0u-jK8nsbCHvz6v_89fxR9moRPyeB947yKOiUFvYa5HalDjSQD7G5lfMnj4DS', rating: 4.9, pages: 342, format: 'EPUB, PDF', description: 'Intersection of ancient contemplative practices and the modern digital age.' }
    ];
    for (const b of initialBooks) {
      await db.query(
        `INSERT INTO books (title, author, category, cover, rating, pages, format, description, uploader) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [b.title, b.author, b.category, b.cover, b.rating, b.pages, b.format, b.description, 'System']
      );
    }
    await initAnalyticsSchema(db);
    console.log("Database initialized and seeded");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const allowedOrigin = process.env.APP_URL?.trim();
  const isCrossOriginDeployment = Boolean(allowedOrigin);

  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP in dev to avoid interference with Vite
    frameguard: false, // AI Studio needs to embed the app in an iframe
  }));

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (allowedOrigin && requestOrigin === allowedOrigin) {
      res.header("Access-Control-Allow-Origin", allowedOrigin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, x-xsrf-token");
      res.header("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(cookieParser());

  // Simple CSRF Protection
  const CSRF_COOKIE_NAME = "XSRF-TOKEN";
  const CSRF_HEADER_NAME = "x-xsrf-token";

  app.use((req, res, next) => {
    let token = req.cookies[CSRF_COOKIE_NAME];
    if (!token) {
      token = crypto.randomBytes(32).toString("hex");
      // Use lax/none for iframe compatibility if needed, but strict should work if domain is same
      res.cookie(CSRF_COOKIE_NAME, token, { 
        sameSite: isCrossOriginDeployment ? "none" : "lax", 
        path: "/",
        secure: process.env.NODE_ENV === "production" || isCrossOriginDeployment,
      });
    }
    
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      const headerToken = req.headers[CSRF_HEADER_NAME];
      const cookieToken = req.cookies[CSRF_COOKIE_NAME];
      if (!headerToken || headerToken !== cookieToken) {
        return res.status(403).json({ error: "Invalid CSRF token" });
      }
    }
    next();
  });

  // Request Logging
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API Request] ${req.method} ${req.path}`);
    }
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    const db = getPool();
    res.json({ 
      status: "ok", 
      database: db ? "Configured" : "Not Configured",
      message: db ? "Connected to CockroachDB" : "Please provide COCKROACH_DB_URL in your environment variables."
    });
  });

  // CSRF token endpoint for the client
  app.get("/api/csrf-token", (req, res) => {
    res.json({ token: req.cookies[CSRF_COOKIE_NAME] });
  });

  // Admin auth routes (mirroring api/admin/*.ts for local dev)
  app.get("/api/admin/session", (req, res) => {
    if (!isAdminAuthConfigured()) {
      return res.json({ authenticated: false, configured: false });
    }
    const admin = requireAdmin(req);
    return res.json({
      authenticated: Boolean(admin),
      configured: true,
      email: admin?.email,
    });
  });

  app.post("/api/admin/login", async (req, res) => {
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
    return res.json({ ok: true, email: String(email).trim().toLowerCase() });
  });

  app.post("/api/admin/logout", (req, res) => {
    clearAdminSessionCookie(res);
    return res.json({ ok: true });
  });

  // ── Admin Book Management Routes ──────────────────────────────────
  // These mirror api/admin/[[...route]].ts for local dev

  app.get("/api/admin/books", async (req, res) => {
    const admin = requireAdmin(req);
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized access. Please log in." });
    }

    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const status = String(req.query.status || 'all').toLowerCase();
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 100);
    const offset = (page - 1) * limit;
    const query = String(req.query.query || '').trim();

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (status !== 'all' && ['pending', 'approved', 'rejected'].includes(status)) {
      params.push(status);
      whereClause += ` AND moderation_status = $${params.length}`;
    }

    if (query) {
      params.push(`%${query}%`);
      const qIdx = params.length;
      whereClause += ` AND (title ILIKE $${qIdx} OR author ILIKE $${qIdx} OR uploader ILIKE $${qIdx})`;
    }

    try {
      const countResult = await db.query(`SELECT COUNT(*) FROM books${whereClause}`, params);
      const total = parseInt(countResult.rows[0].count, 10);
      const listParams = [...params, String(limit), String(offset)];
      const result = await db.query(
        `SELECT id, title, author, category, cover, rating, pages, format, uploader, description,
                file_name, file_type, file_size, date_added,
                moderation_status, moderation_note, reviewed_at, reviewed_by,
                file_data IS NOT NULL AS has_file
         FROM books${whereClause}
         ORDER BY date_added DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      );

      return res.json({
        books: result.rows.map((row: any) => ({ ...row, has_file: row.has_file ?? false })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err: any) {
      console.error('[Admin Books List Error]', err.message);
      return res.status(500).json({ error: 'Failed to fetch books' });
    }
  });

  app.get("/api/admin/books/:id", async (req, res) => {
    const admin = requireAdmin(req);
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized access. Please log in." });
    }

    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    try {
      const result = await db.query(
        `SELECT id, title, author, category, cover, rating, pages, format, uploader, description,
                file_name, file_type, file_size, date_added,
                moderation_status, moderation_note, reviewed_at, reviewed_by,
                file_data IS NOT NULL AS has_file
         FROM books WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Book not found' });
      }
      return res.json({ ...result.rows[0], has_file: result.rows[0].has_file ?? false });
    } catch (err: any) {
      console.error('[Admin Book Get Error]', err.message);
      return res.status(500).json({ error: 'Failed to fetch book' });
    }
  });

  app.post("/api/admin/books/:id/moderate", async (req, res) => {
    const admin = requireAdmin(req);
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized access. Please log in." });
    }

    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const action = String(req.body?.action || '').toLowerCase();
    const note = req.body?.note ? String(req.body.note).slice(0, 2000) : null;

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }

    const moderationStatus = action === 'approve' ? 'approved' : 'rejected';

    try {
      const result = await db.query(
        `UPDATE books SET
          moderation_status = $2,
          moderation_note = $3,
          reviewed_at = now(),
          reviewed_by = $4
        WHERE id = $1
        RETURNING id, title, author, category, cover, rating, pages, format, uploader, description,
                  file_name, file_type, file_size, date_added,
                  moderation_status, moderation_note, reviewed_at, reviewed_by,
                  file_data IS NOT NULL AS has_file`,
        [req.params.id, moderationStatus, note, admin.email]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Book not found' });
      }

      return res.json({ ...result.rows[0], has_file: result.rows[0].has_file ?? false });
    } catch (err: any) {
      console.error('[Admin Moderate Error]', err.message);
      return res.status(500).json({ error: 'Failed to moderate book' });
    }
  });

  app.patch("/api/admin/books/:id", async (req, res) => {
    const admin = requireAdmin(req);
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized access. Please log in." });
    }

    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const id = req.params.id;
    const body = req.body || {};

    try {
      const existing = await db.query(`SELECT id FROM books WHERE id = $1 LIMIT 1`, [id]);
      if (existing.rowCount === 0) {
        return res.status(404).json({ error: 'Book not found' });
      }

      const result = await db.query(
        `UPDATE books SET
          title = COALESCE($2, title),
          author = COALESCE($3, author),
          category = COALESCE($4, category),
          description = COALESCE($5, description),
          rating = COALESCE($6, rating),
          pages = COALESCE($7, pages),
          format = COALESCE($8, format),
          cover = COALESCE($9, cover),
          uploader = COALESCE($10, uploader),
          moderation_status = COALESCE($11, moderation_status),
          moderation_note = COALESCE($12, moderation_note),
          reviewed_at = CASE WHEN $11 IS NOT NULL THEN now() ELSE reviewed_at END,
          reviewed_by = CASE WHEN $11 IS NOT NULL THEN $13 ELSE reviewed_by END
        WHERE id = $1
        RETURNING id, title, author, category, cover, rating, pages, format, uploader, description,
                  file_name, file_type, file_size, date_added,
                  moderation_status, moderation_note, reviewed_at, reviewed_by,
                  file_data IS NOT NULL AS has_file`,
        [
          id,
          body.title || null, body.author || null, body.category || null,
          body.description || null, body.rating ?? null, body.pages ?? null,
          body.format || null, body.cover || null, body.uploader || null,
          body.moderationStatus || body.moderation_status || null,
          body.moderationNote != null ? String(body.moderationNote) : body.moderation_note != null ? String(body.moderation_note) : null,
          admin.email,
        ]
      );

      return res.json({ ...result.rows[0], has_file: result.rows[0].has_file ?? false });
    } catch (err: any) {
      console.error('[Admin Book Update Error]', err.message);
      return res.status(500).json({ error: 'Failed to update book' });
    }
  });

  app.delete("/api/admin/books/:id", async (req, res) => {
    const admin = requireAdmin(req);
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized access. Please log in." });
    }

    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    try {
      const result = await db.query(`DELETE FROM books WHERE id = $1 RETURNING id`, [req.params.id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Book not found' });
      }
      return res.json({ ok: true, id: req.params.id });
    } catch (err: any) {
      console.error('[Admin Book Delete Error]', err.message);
      return res.status(500).json({ error: 'Failed to delete book' });
    }
  });

  app.get("/api/admin/books/:id/file", async (req, res) => {
    const admin = requireAdmin(req);
    if (!admin) {
      return res.status(401).json({ error: "Unauthorized access. Please log in." });
    }

    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    try {
      const result = await db.query(
        `SELECT id, title, format, file_name, file_type, file_size, file_data, moderation_status
         FROM books WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Book not found' });
      }
      if (!result.rows[0].file_data) {
        return res.status(404).json({ error: 'No file stored for this book' });
      }
      return res.json(result.rows[0]);
    } catch (err: any) {
      console.error('[Admin Book File Error]', err.message);
      return res.status(500).json({ error: 'Failed to fetch book file' });
    }
  });

  app.post("/api/analytics", async (req, res) => {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const userAgent = req.headers['user-agent'] || '';
    if (/bot|spider|crawl|slurp|lighthouse|headless|selenium|puppeteer|screaming/i.test(userAgent)) {
      return res.json({ ok: true, status: 'ignored_bot' });
    }

    const { type, payload } = req.body || {};
    if (!type || !payload || !payload.visitorId || !payload.sessionToken) {
      return res.status(400).json({ error: 'Invalid event payload' });
    }

    const { visitorId, sessionToken, referrer, path, screenName, timestamp } = payload;
    
    // Anonymize IP
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = rawIp.split(',')[0].trim();
    
    const hashedVisitorHash = crypto.createHash('sha256').update(visitorId + 'sanctuary-salt').digest('hex');

    // Simple device parsing
    let device = 'Desktop';
    if (/mobile|android|iphone|ipad|phone/i.test(userAgent)) {
      device = /ipad|tablet/i.test(userAgent) ? 'Tablet' : 'Mobile';
    }
    let os = 'Unknown OS';
    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
    else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
    else if (/android/i.test(userAgent)) os = 'Android';
    else if (/linux/i.test(userAgent)) os = 'Linux';

    let browser = 'Unknown Browser';
    if (/chrome|crios/i.test(userAgent) && !/edge|edg/i.test(userAgent) && !/opr/i.test(userAgent)) browser = 'Chrome';
    else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) browser = 'Safari';
    else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
    else if (/edge|edg/i.test(userAgent)) browser = 'Edge';
    else if (/opr/i.test(userAgent)) browser = 'Opera';

    try {
      const visitorRes = await db.query(
        `INSERT INTO analytics_visitors (visitor_hash, device_type, browser, os, referrer, country, first_seen, last_seen)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (visitor_hash) DO UPDATE 
         SET last_seen = EXCLUDED.last_seen
         RETURNING id, (first_seen < now() - INTERVAL '30 minutes') as is_returning_visitor`,
        [
          hashedVisitorHash,
          device,
          browser,
          os,
          referrer ? String(referrer).substring(0, 255) : 'Direct',
          'Unknown',
          timestamp,
          timestamp
        ]
      );

      const dbVisitorId = visitorRes.rows[0].id;
      const isReturning = visitorRes.rows[0].is_returning_visitor;

      if (isReturning) {
        await db.query(`UPDATE analytics_visitors SET is_returning = TRUE WHERE id = $1`, [dbVisitorId]);
      }

      const sessionRes = await db.query(
        `INSERT INTO analytics_sessions (visitor_id, session_token, started_at, last_activity)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_token) DO UPDATE 
         SET last_activity = EXCLUDED.last_activity
         RETURNING id`,
        [dbVisitorId, sessionToken, timestamp, timestamp]
      );

      const dbSessionId = sessionRes.rows[0].id;

      if (type === 'pageview') {
        await db.query(
          `INSERT INTO analytics_page_views (session_id, visitor_id, path, screen_name, timestamp)
           VALUES ($1, $2, $3, $4, $5)`,
          [dbSessionId, dbVisitorId, path || '/', screenName || 'Unknown', timestamp]
        );
      } 
      else if (type === 'bookview') {
        const bookId = payload.bookId;
        if (bookId) {
          await db.query(
            `INSERT INTO analytics_book_views (session_id, visitor_id, book_id, timestamp)
             VALUES ($1, $2, $3, $4)`,
            [dbSessionId, dbVisitorId, bookId, timestamp]
          );
        }
      } 
      else if (type === 'download') {
        const bookId = payload.bookId;
        if (bookId) {
          await db.query(
            `INSERT INTO analytics_downloads (session_id, visitor_id, book_id, timestamp)
             VALUES ($1, $2, $3, $4)`,
            [dbSessionId, dbVisitorId, bookId, timestamp]
          );
        }
      } 
      else if (type === 'heartbeat') {
        const duration = parseInt(payload.durationSeconds, 10) || 0;
        if (duration > 0) {
          await db.query(
            `UPDATE analytics_sessions
             SET duration_seconds = duration_seconds + $1, bounce = FALSE, last_activity = $2
             WHERE id = $3`,
            [duration, timestamp, dbSessionId]
          );
        }
      } 
      else if (type === 'custom') {
        await db.query(
          `INSERT INTO analytics_events (session_id, visitor_id, event_type, event_data, timestamp)
           VALUES ($1, $2, $3, $4, $5)`,
          [dbSessionId, dbVisitorId, payload.eventType || 'unknown', payload.eventData || null, timestamp]
        );
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error('Express analytics error:', err.message);
      res.status(500).json({ error: 'Failed to record tracking event' });
    }
  });

  app.get("/api/admin/analytics", async (req, res) => {
    const admin = requireAdmin(req);
    if (!admin) {
      return res.status(401).json({ error: "Admin authentication required" });
    }

    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const mode = String(req.query.mode || 'summary');

    try {
      if (mode === 'export') {
        const type = String(req.query.type || 'traffic');
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
        } 
        else {
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

        return res.json({
          summary: {
            activeUsers,
            visitorsToday,
            visitorsGrowth,
            pageviewsToday,
            pageviewsGrowth,
            downloadsToday,
            downloadsGrowth,
            totalUniqueVisitors,
            totalPageviews,
            totalDownloads,
            totalBooks,
            avgSessionDuration,
            bounceRate
          },
          dailyTrends,
          dailyDownloads,
          topBooks: topBooksRes.rows,
          topCategories: topCategoriesRes.rows,
          technology: {
            devices: deviceRes.rows,
            browsers: browserRes.rows,
            os: osRes.rows
          },
          liveFeed
        });
      }

      res.status(400).json({ error: "Invalid mode" });
    } catch (err: any) {
      console.error('Express analytics summary error:', err.message);
      res.status(500).json({ error: "Failed to compile stats" });
    }
  });

  app.get("/api/books", async (req, res) => {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const { query, category, format, sortBy, page = "1", limit = "50" } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = " WHERE (moderation_status IS NULL OR moderation_status = 'approved')";
    const params: any[] = [];

    let orderBy = "date_added DESC";
    if (query) {
      params.push(query);
      const qIdx = params.length;
      whereClause += ` AND (
        search_vector @@ websearch_to_tsquery('english', $${qIdx})
        OR title ILIKE '%' || $${qIdx} || '%' 
        OR author ILIKE '%' || $${qIdx} || '%'
        OR similarity(title, $${qIdx}) > 0.2
        OR similarity(author, $${qIdx}) > 0.2
      )`;
      
      if (!sortBy || sortBy === "newest") {
        orderBy = `ts_rank(search_vector, websearch_to_tsquery('english', $${qIdx})) DESC, similarity(title, $${qIdx}) DESC`;
      }
    }

    if (category && category !== "All") {
      params.push(category);
      whereClause += ` AND category = $${params.length}`;
    }

    if (format && format !== "All") {
      params.push(format);
      whereClause += ` AND format ILIKE '%' || $${params.length} || '%'`;
    }

    if (sortBy === "newest" && !query) orderBy = "date_added DESC";
    else if (sortBy === "title") orderBy = "title ASC";
    else if (sortBy === "author") orderBy = "author ASC";
    else if (sortBy === "rating") orderBy = "rating DESC";
    else if (sortBy === "oldest") orderBy = "date_added ASC";

    try {
      const countResult = await db.query(`SELECT COUNT(*) FROM books${whereClause}`, params);
      const total = parseInt(countResult.rows[0].count);

      const sql = `SELECT id, title, author, category, cover, rating, pages, format, uploader, description, file_name, file_type, file_size, date_added, file_data IS NOT NULL AS has_file FROM books${whereClause} ORDER BY ${orderBy} LIMIT ${limitNum} OFFSET ${offset}`;
      const result = await db.query(sql, params);
      
      res.json({
        books: result.rows,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
      });
    } catch (err) {
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.post("/api/books", async (req, res) => {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    let { title, author, category, description, rating, pages, format, cover, uploader, fileName, fileType, fileSize, fileData } = req.body;

    // Server-side validation
    if (!title || !author || !category || !description || !fileName || !fileData) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const ratingNum = parseFloat(rating);
    const pagesNum = parseInt(pages);
    const fileSizeNum = parseInt(fileSize);

    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    if (isNaN(pagesNum) || pagesNum < 1) {
      return res.status(400).json({ error: "Pages must be at least 1" });
    }

    if (isNaN(fileSizeNum) || fileSizeNum < 1 || fileSizeNum > 3 * 1024 * 1024) {
      return res.status(400).json({ error: "Book file must be 3MB or smaller" });
    }

    // XSS Sanitization
    title = xss(String(title));
    author = xss(String(author));
    category = xss(String(category));
    description = xss(String(description));
    format = xss(String(format || ""));
    cover = xss(String(cover || "/Sacred+Rhythms.png"));
    uploader = xss(String(uploader || "Community User"));
    fileName = xss(String(fileName));
    fileType = xss(String(fileType || "application/octet-stream"));
    fileData = String(fileData);

    if (!fileData.startsWith("data:")) {
      return res.status(400).json({ error: "Invalid book file payload" });
    }

    try {
      const result = await db.query(
        `INSERT INTO books (title, author, category, description, rating, pages, format, cover, uploader, file_name, file_type, file_size, file_data, moderation_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
         RETURNING *`,
        [title, author, category, description, ratingNum, pagesNum, format, cover, uploader, fileName, fileType, fileSizeNum, fileData]
      );
      res.status(201).json({
        ...result.rows[0],
        message: 'Thank you! Your submission is pending review and will appear in the library once approved.',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to upload book" });
    }
  });

  app.post("/api/books/batch", async (req, res) => {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const { books } = req.body;
    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ error: "Books array is required" });
    }

    if (books.length > 20) {
      return res.status(400).json({ error: "Maximum batch size is 20 books" });
    }

    const results = [];
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < books.length; i++) {
        let { title, author, category, description, rating, pages, format, cover, uploader, fileName, fileType, fileSize, fileData } = books[i];

        if (!title || !author || !category || !description || !fileName || !fileData) {
          throw new Error(`Book ${i + 1} ("${title || "Untitled"}") is missing required fields`);
        }

        const ratingNum = parseFloat(rating) || 5;
        const pagesNum = parseInt(pages) || 100;
        const fileSizeNum = parseInt(fileSize) || 0;

        title = xss(String(title));
        author = xss(String(author));
        category = xss(String(category));
        description = xss(String(description));
        format = xss(String(format || ""));
        cover = xss(String(cover || "/Sacred+Rhythms.png"));
        uploader = xss(String(uploader || "Community User"));
        fileName = xss(String(fileName));
        fileType = xss(String(fileType || "application/octet-stream"));

        const result = await client.query(
          `INSERT INTO books (title, author, category, description, rating, pages, format, cover, uploader, file_name, file_type, file_size, file_data, moderation_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
           RETURNING *`,
          [title, author, category, description, ratingNum, pagesNum, format, cover, uploader, fileName, fileType, fileSizeNum, fileData]
        );
        results.push(result.rows[0]);
      }
      await client.query("COMMIT");
      res.status(201).json({ success: true, books: results });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("[Batch Upload Error]", err);
      res.status(500).json({ error: err.message || "Batch upload failed" });
    } finally {
      client.release();
    }
  });

  app.get("/api/books/:id/file", async (req, res) => {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    try {
      const result = await db.query(
        `SELECT id, title, format, file_name, file_type, file_size, file_data, file_data IS NOT NULL AS has_file
         FROM books
         WHERE id = $1 AND (moderation_status IS NULL OR moderation_status = 'approved')
         LIMIT 1`,
        [req.params.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Book not found" });
      }

      if (!result.rows[0].file_data) {
        return res.status(404).json({ error: "No uploaded file found for this book" });
      }

      return res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch book file" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  console.log("Vite middleware setup complete");
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initDb().catch(err => console.error("Database initialization failed:", err));
  });
}

startServer();
