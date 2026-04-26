import { getPool } from './_lib/db';
import { applyCors, handleOptions } from './_lib/http';

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

  const db = getPool();
  res.status(200).json({
    status: 'ok',
    database: db ? 'Configured' : 'Not Configured',
    message: db ? 'Connected to CockroachDB' : 'Please provide COCKROACH_DB_URL in your environment variables.',
  });
}
