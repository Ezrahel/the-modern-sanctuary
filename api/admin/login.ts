import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  isAdminAuthConfigured,
  setAdminSessionCookie,
  signAdminSession,
  verifyAdminCredentials,
} from '../_lib/auth';
import { applyCors, handleOptions } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

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
