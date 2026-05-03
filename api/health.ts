import { getDbDiagnostic } from './_lib/db';
import { applyCors, handleOptions } from './_lib/http';

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);

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
}
