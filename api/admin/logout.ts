import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearAdminSessionCookie } from '../_lib/auth';
import { applyCors, handleOptions } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  clearAdminSessionCookie(res);
  return res.status(200).json({ ok: true });
}
