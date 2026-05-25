import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAdminAuthConfigured, requireAdmin } from '../_lib/auth';
import { applyCors, handleOptions } from '../_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

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
