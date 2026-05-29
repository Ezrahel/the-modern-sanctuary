import type { Pool as PgPool } from 'pg';
import { getCockroachDbUrl } from './env';

import { MAX_BOOK_FILE_BYTES } from './limits';

const MAX_UPLOAD_BYTES = MAX_BOOK_FILE_BYTES;

let pool: PgPool | null = null;
let dbConfigErrorLogged = false;
let initPromise: Promise<void> | null = null;
let PoolConstructor: typeof PgPool | null = null;

function getPgPoolClass(): typeof PgPool {
  if (!PoolConstructor) {
    // Use the runtime CJS require (do not shadow it with createRequire).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Pool = require('pg').Pool as typeof PgPool;
    PoolConstructor = Pool;
  }
  return PoolConstructor;
}

export type DbDiagnostic = {
  configured: boolean;
  validUrl: boolean;
  initialized: boolean;
  stage: 'env' | 'connect' | 'init' | 'ready';
  message: string;
};

function isValidPostgresUrl(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
  } catch {
    return false;
  }
}

export function getPool() {
  if (!pool) {
    const connectionString = getCockroachDbUrl();
    if (!connectionString) {
      console.warn('COCKROACH_DB_URL is not defined. Database features will be unavailable.');
      return null;
    }

    if (!isValidPostgresUrl(connectionString)) {
      if (!dbConfigErrorLogged) {
        console.warn(
          'COCKROACH_DB_URL is invalid. Expected a full postgres URL like ' +
            '"postgresql://username:password@host:26257/database?sslmode=require". ' +
            'Database features will be unavailable until this is fixed.'
        );
        dbConfigErrorLogged = true;
      }
      return null;
    }

    try {
      const Pool = getPgPoolClass();
      pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false,
        },
        connectionTimeoutMillis: 10000,
      });
    } catch (error) {
      if (!dbConfigErrorLogged) {
        console.warn('Failed to configure database pool. Database features will be unavailable.', error);
        dbConfigErrorLogged = true;
      }
      return null;
    }
  }

  return pool;
}

export async function getDbDiagnostic(): Promise<DbDiagnostic> {
  const connectionString = getCockroachDbUrl();
  if (!connectionString) {
    return {
      configured: false,
      validUrl: false,
      initialized: false,
      stage: 'env',
      message: 'COCKROACH_DB_URL is not defined.',
    };
  }

  if (!isValidPostgresUrl(connectionString)) {
    return {
      configured: true,
      validUrl: false,
      initialized: false,
      stage: 'env',
      message:
        'COCKROACH_DB_URL is not a valid postgres connection string. In Vercel, set only the URL as the value (no KEY=, quotes, or comment lines).',
    };
  }

  const db = getPool();
  if (!db) {
    return {
      configured: true,
      validUrl: true,
      initialized: false,
      stage: 'connect',
      message: 'The database pool could not be created.',
    };
  }

  try {
    await db.query('SELECT 1');
  } catch (error: any) {
    return {
      configured: true,
      validUrl: true,
      initialized: false,
      stage: 'connect',
      message: error?.message || 'The database connection test failed.',
    };
  }

  try {
    await ensureDbInitialized();
    return {
      configured: true,
      validUrl: true,
      initialized: true,
      stage: 'ready',
      message: 'Connected to CockroachDB and schema is ready.',
    };
  } catch (error: any) {
    return {
      configured: true,
      validUrl: true,
      initialized: false,
      stage: 'init',
      message: error?.message || 'Database initialization failed.',
    };
  }
}

async function seedBooks(db: PgPool) {
  const countRes = await db.query('SELECT COUNT(*) FROM books');
  if (parseInt(countRes.rows[0].count, 10) > 0) return;

  const initialBooks = [
    {
      title: 'The Sacred Rhythm: Walking with Christ',
      author: 'Jonathan P. Silas',
      category: 'Christian Living',
      cover: 'https://images.unsplash.com/photo-1519781542704-957ff19eff00?auto=format&fit=crop&q=80&w=800',
      rating: 4.9,
      pages: 312,
      format: 'EPUB, PDF',
      description: 'A profound exploration of finding sacred rhythm in an age of constant noise.',
    },
    {
      title: 'Shadows of Grace',
      author: 'Marcus V. Sterling',
      category: 'Theology',
      cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC691ht-QFxMQmdCpT6PiuCeUSWelsGIJ8A1XvTXNOv-jmHdLsNrHyGYvMX7Iv30VNRLU_2E5kILgysmrICBWYvHT69sQEjFkkOyuZBfGEnlhqcmpEuQqw3HJlHLoFfMHwZ4YFh2tXCQOsEUo0ufISwC67svMl-i__RmamFix5KKOi35kZTG2LPpVAVvc1IsPorV1SVwBLixKKdooH8qO5BpdaGnL8YUkkpzxVfAeMcdXmXuXoPtVKP-Lnhtaa9i0-pI426kJ67NGKE',
      rating: 4.5,
      pages: 200,
      format: 'PDF',
      description: 'Exploring the depths of grace.',
    },
    {
      title: 'The Silent Echo',
      author: 'Julian Thorne',
      category: 'Philosophy',
      cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbxlRAe5A8ImWb9OWEVaTn4JXsf61mC3s3ccVad-Hasyc25nyu9-Nw7UwSr0XdL0b-sXbNKdf4wAaz_WEK7yCJx4amEDLuuSWiHqZzhjguDOJk0jAUcPLDw6S4BkygaYYr_O0TuZdFikkg9U4VwlxMNtlVQhtS6eK7MnH9XlqmrzFJHOtTCYwzA3EQsnlrKEB4tUjpeDnLeYpvFb0u-jK8nsbCHvz6v_89fxR9moRPyeB947yKOiUFvYa5HalDjSQD7G5lfMnj4DS',
      rating: 4.9,
      pages: 342,
      format: 'EPUB, PDF',
      description: 'Intersection of ancient contemplative practices and the modern digital age.',
    },
  ];

  for (const book of initialBooks) {
    await db.query(
      `INSERT INTO books (title, author, category, cover, rating, pages, format, description, uploader)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [book.title, book.author, book.category, book.cover, book.rating, book.pages, book.format, book.description, 'System']
    );
  }
}

async function reconcileExistingBooksSchema(db: PgPool) {
  await db.query(`
    ALTER TABLE books
    ADD COLUMN IF NOT EXISTS file_name STRING,
    ADD COLUMN IF NOT EXISTS file_type STRING,
    ADD COLUMN IF NOT EXISTS file_size INT,
    ADD COLUMN IF NOT EXISTS file_data STRING,
    ADD COLUMN IF NOT EXISTS date_added TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS moderation_status STRING DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS moderation_note STRING,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by STRING;
  `);

  await db.query(`
    UPDATE books SET moderation_status = 'approved' WHERE moderation_status IS NULL;
  `);

  await db.query(`
    ALTER TABLE books
    ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
    AS (
      to_tsvector(
        'english',
        COALESCE(title, '') || ' ' || COALESCE(author, '') || ' ' || COALESCE(description, '')
      )
    ) STORED;
  `).catch((err) => {
    console.warn('Optional search_vector column could not be created/verified.', err.message);
  });

  await db.query(`
    CREATE INDEX IF NOT EXISTS books_search_idx ON books USING GIN (search_vector);
  `).catch((err) => {
    console.warn('Optional books_search_idx index could not be created/verified.', err.message);
  });
}

async function initAnalyticsSchema(db: PgPool) {
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
    throw error;
  }
}

export async function ensureDbInitialized() {
  const db = getPool();
  if (!db) return null;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        try {
          await db.query('SELECT 1 FROM books LIMIT 1');
          await reconcileExistingBooksSchema(db);
          await initAnalyticsSchema(db);
          return;
        } catch {
          console.log('Books table not found or inaccessible, starting full initialization...');
        }

        console.log('Initializing database schema for the first time...');

        await db.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`).catch((err) => {
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
            date_added TIMESTAMPTZ DEFAULT now(),
            moderation_status STRING DEFAULT 'approved',
            moderation_note STRING,
            reviewed_at TIMESTAMPTZ,
            reviewed_by STRING,
            search_vector TSVECTOR AS (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(author, '') || ' ' || COALESCE(description, ''))) STORED
          );
          CREATE INDEX IF NOT EXISTS books_search_idx ON books USING GIN (search_vector);
        `);

        await seedBooks(db);
        await initAnalyticsSchema(db);
        console.log('Database schema initialization complete.');
      } catch (error: any) {
        console.error('CRITICAL: Database initialization failed:', {
          message: error.message,
          code: error.code,
          detail: error.detail,
        });
        initPromise = null;
        throw error;
      }
    })();
  }

  await initPromise;
  return db;
}

export { MAX_UPLOAD_BYTES };
