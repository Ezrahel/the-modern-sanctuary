import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handleOptions } from './_lib/http';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (handleOptions(req, res)) return;
    applyCors(req, res);

    // Load DB only inside the handler so a bad pg bundle cannot crash module init.
    const { getDbDiagnostic } = await import('./_lib/db');
    const diagnostic = await getDbDiagnostic();

    res.status(200).json({
      status: 'ok',
      database: diagnostic.initialized ? 'Ready' : diagnostic.configured ? 'Configured but failing' : 'Not Configured',
      configured: diagnostic.configured,
      validUrl: diagnostic.validUrl,
      initialized: diagnostic.initialized,
      stage: diagnostic.stage,
      message: diagnostic.message,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    console.error('Health check crashed:', err);
    res.status(500).json({
      status: 'error',
      message: err?.message || 'Health check failed',
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    });
  }
}
