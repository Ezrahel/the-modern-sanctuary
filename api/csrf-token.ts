import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, ensureCsrfCookie, handleOptions } from './_lib/http';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

  const token = ensureCsrfCookie(req, res);
  res.status(200).json({ token });
}
