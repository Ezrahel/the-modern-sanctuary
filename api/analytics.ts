import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureDbInitialized } from './_lib/db';
import { applyCors, handleOptions } from './_lib/http';
import { createHash } from 'node:crypto';

// Rate Limiting (in-memory simple cache for serverless instance)
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
const LIMIT = 300; // max 300 events per 5 minutes per IP
const WINDOW_MS = 5 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const state = rateLimitCache.get(ip);
  if (!state) {
    rateLimitCache.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return false;
  }
  if (now > state.resetTime) {
    rateLimitCache.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return false;
  }
  state.count += 1;
  return state.count > LIMIT;
}

// Bot filtering regex
const BOT_USER_AGENTS = /bot|spider|crawl|slurp|lighthouse|headless|selenium|puppeteer|screaming/i;

function parseUserAgent(ua: string | undefined) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };

  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let device = 'Desktop';

  // Device type detection
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) {
    device = /ipad|tablet/i.test(ua) ? 'Tablet' : 'Mobile';
  } else {
    device = 'Desktop';
  }

  // OS detection
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  // Browser detection
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opr/i.test(ua)) browser = 'Opera';

  return { browser, os, device };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userAgent = req.headers['user-agent'] || '';
  if (BOT_USER_AGENTS.test(userAgent)) {
    return res.status(200).json({ ok: true, status: 'ignored_bot' });
  }

  // Get Client IP and anonymize
  const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const clientIp = rawIp.split(',')[0].trim();

  // Simple IP Rate Limit check
  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const db = await ensureDbInitialized();
  if (!db) {
    return res.status(503).json({ error: 'Database is unavailable' });
  }

  const { type, payload } = req.body || {};
  if (!type || !payload || !payload.visitorId || !payload.sessionToken) {
    return res.status(400).json({ error: 'Invalid event payload' });
  }

  const { visitorId, sessionToken, referrer, path, screenName, timestamp } = payload;
  const { browser, os, device } = parseUserAgent(userAgent);

  // Simple IP anonymization/hashing
  const hashedVisitorHash = createHash('sha256').update(visitorId + 'sanctuary-salt').digest('hex');

  try {
    // 1. Ensure Visitor Exists
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
        'Unknown', // In vercel, you can use headers['x-vercel-ip-country'] for geolocation!
        timestamp,
        timestamp
      ]
    );

    const dbVisitorId = visitorRes.rows[0].id;
    const isReturning = visitorRes.rows[0].is_returning_visitor;

    if (isReturning) {
      await db.query(
        `UPDATE analytics_visitors SET is_returning = TRUE WHERE id = $1`,
        [dbVisitorId]
      );
    }

    // 2. Ensure Session Exists
    const sessionRes = await db.query(
      `INSERT INTO analytics_sessions (visitor_id, session_token, started_at, last_activity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_token) DO UPDATE 
       SET last_activity = EXCLUDED.last_activity
       RETURNING id`,
      [dbVisitorId, sessionToken, timestamp, timestamp]
    );

    const dbSessionId = sessionRes.rows[0].id;

    // 3. Insert specific events based on type
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
        // Increment session duration and mark bounce = false since the session is active
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

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Analytics tracking error:', error.message);
    return res.status(500).json({ error: 'Failed to record tracking event' });
  }
}
