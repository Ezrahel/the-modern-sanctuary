/** Normalize values pasted from .env files into Vercel's UI (quotes, KEY=, comments). */
export function normalizeEnvValue(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;

  let value = String(raw).trim();
  if (!value) return undefined;

  // If someone pasted "KEY=value" into the value field, strip the key.
  const keyPrefix = /^[A-Z][A-Z0-9_]*=/;
  if (keyPrefix.test(value)) {
    value = value.replace(/^[A-Z][A-Z0-9_]*=/, '').trim();
  }

  // First line only — ignore trailing comment lines from .env paste.
  value = value.split(/\r?\n/)[0].trim();
  if (!value || value.startsWith('#')) return undefined;

  // Strip wrapping quotes from values like "" or "https://..."
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value || undefined;
}

export function getCockroachDbUrl(): string | undefined {
  return normalizeEnvValue(process.env.COCKROACH_DB_URL);
}

export function getAppUrl(): string | undefined {
  return normalizeEnvValue(process.env.APP_URL);
}
