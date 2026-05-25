const { normalizeEnvValue } = require('./_lib/env.cjs');

module.exports = async function handler(req, res) {
  const dbUrl = normalizeEnvValue(process.env.COCKROACH_DB_URL);

  res.status(200).json({
    ok: true,
    node: process.version,
    hasDbEnv: Boolean(dbUrl),
    dbEnvLooksValid: dbUrl ? /^postgres(ql)?:\/\//i.test(dbUrl) : false,
    hint: dbUrl
      ? 'Env looks parseable. If /api/health still fails, check Vercel function logs.'
      : 'Set COCKROACH_DB_URL in Vercel (value = URL only, one line, no comments).',
  });
};
