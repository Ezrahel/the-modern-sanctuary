function normalizeEnvValue(raw) {
  if (raw == null) return undefined;

  let value = String(raw).trim();
  if (!value) return undefined;

  if (/^[A-Z][A-Z0-9_]*=/.test(value)) {
    value = value.replace(/^[A-Z][A-Z0-9_]*=/, '').trim();
  }

  value = value.split(/\r?\n/)[0].trim();
  if (!value || value.startsWith('#')) return undefined;

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value || undefined;
}

module.exports = { normalizeEnvValue };
