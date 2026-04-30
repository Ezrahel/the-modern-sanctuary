import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbConfigErrorLogged = false;
let initPromise: Promise<void> | null = null;

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
    const connectionString = process.env.COCKROACH_DB_URL;
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
      pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false,
        },
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

async function seedBooks(db: pg.Pool) {
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

export async function ensureDbInitialized() {
  const db = getPool();
  if (!db) return null;

  if (!initPromise) {
    initPromise = (async () => {
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
          file_name STRING,
          file_type STRING,
          file_size INT,
          file_data STRING,
          date_added TIMESTAMPTZ DEFAULT now(),
          search_vector TSVECTOR AS (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(author, '') || ' ' || COALESCE(description, ''))) STORED
        );
        CREATE INDEX IF NOT EXISTS books_search_idx ON books USING GIN (search_vector);
      `);
      await db.query(`
        ALTER TABLE books
        ADD COLUMN IF NOT EXISTS file_name STRING,
        ADD COLUMN IF NOT EXISTS file_type STRING,
        ADD COLUMN IF NOT EXISTS file_size INT,
        ADD COLUMN IF NOT EXISTS file_data STRING;
      `);
      await seedBooks(db);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
  return db;
}
