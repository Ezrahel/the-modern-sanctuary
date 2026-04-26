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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Lazy initialization of database pool
let pool: pg.Pool | null = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.COCKROACH_DB_URL;
    if (!connectionString) {
      console.warn("COCKROACH_DB_URL is not defined. Database features will be unavailable.");
      return null;
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // For development convenience, but consider stricter settings for production
      },
    });
  }
  return pool;
}

async function initDb() {
  const db = getPool();
  if (!db) return;

  try {
    await db.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
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
        date_added TIMESTAMPTZ DEFAULT now(),
        search_vector TSVECTOR AS (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(author, '') || ' ' || COALESCE(description, ''))) STORED
      );
      CREATE INDEX IF NOT EXISTS books_search_idx ON books USING GIN (search_vector);
    `);

    // Seed if empty
    const countRes = await db.query('SELECT COUNT(*) FROM books');
    if (parseInt(countRes.rows[0].count) === 0) {
      console.log("Seeding database with initial books...");
      // Ideally we should import BOOKS from constants.ts but server.ts is separate.
      // For now, I'll add a few initial books to seed.
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
    }
    console.log("Database initialized");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP in dev to avoid interference with Vite
    frameguard: false, // AI Studio needs to embed the app in an iframe
  }));

  app.use(express.json());
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
        sameSite: "lax", 
        path: "/",
        secure: process.env.NODE_ENV === "production" 
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

  app.get("/api/books", async (req, res) => {
    const db = getPool();
    if (!db) return res.status(503).json({ error: "Database not configured" });

    const { query, category, format, sortBy, page = "1", limit = "50" } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    let whereClause = " WHERE 1=1";
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

      const sql = `SELECT * FROM books${whereClause} ORDER BY ${orderBy} LIMIT ${limitNum} OFFSET ${offset}`;
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

    let { title, author, category, description, rating, pages, format, cover, uploader } = req.body;

    // Server-side validation
    if (!title || !author || !category || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const ratingNum = parseFloat(rating);
    const pagesNum = parseInt(pages);

    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    if (isNaN(pagesNum) || pagesNum < 1) {
      return res.status(400).json({ error: "Pages must be at least 1" });
    }

    // XSS Sanitization
    title = xss(String(title));
    author = xss(String(author));
    category = xss(String(category));
    description = xss(String(description));
    format = xss(String(format || ""));
    cover = xss(String(cover || ""));
    uploader = xss(String(uploader || "Community User"));

    try {
      const result = await db.query(
        `INSERT INTO books (title, author, category, description, rating, pages, format, cover, uploader)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [title, author, category, description, ratingNum, pagesNum, format, cover, uploader]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to upload book" });
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
