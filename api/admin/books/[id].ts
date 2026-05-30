import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAdminBookById } from '../../_lib/admin-book-handlers';
import { applyCors, handleOptions } from '../../_lib/http';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);
  return handleAdminBookById(req, res);
}
