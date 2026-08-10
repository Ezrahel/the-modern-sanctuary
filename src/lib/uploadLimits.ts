export const MAX_BOOK_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_COVER_BYTES = 512 * 1024;
export const MAX_BATCH_FILES = 10;
export const MAX_BATCH_CONCURRENCY = 2;
export const ALLOWED_BOOK_ACCEPT =
  '.pdf,.epub,.mobi,.doc,.docx,application/pdf,application/epub+zip,application/x-mobipocket-ebook,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Vercel hard-caps the request body of a Serverless Function at 4.5MB on every
 * plan (Hobby, Pro, Enterprise). Files are sent as base64 inside JSON, which
 * inflates size by ~33%, so a request can blow past the cap even when the raw
 * file is under MAX_BOOK_FILE_BYTES. This is the platform ceiling; nothing in
 * our config can raise it.
 */
export const PLATFORM_PAYLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024;

/** Client-side safety ceiling: keep a margin under the platform cap. */
export const MAX_SAFE_PAYLOAD_BYTES = Math.floor(PLATFORM_PAYLOAD_LIMIT_BYTES * 0.94);

/** Measure the exact number of bytes fetch() will transmit for a JSON body. */
export function estimateJsonPayloadBytes(body: unknown): number {
  return new TextEncoder().encode(JSON.stringify(body)).length;
}

/**
 * Reject an upload on the client BEFORE it is sent, so the user never sees a
 * raw platform error like "Request Entity Too Large / FUNCTION_PAYLOAD_TOO_LARGE".
 */
export function assertPayloadFits(payload: unknown, fileName?: string): void {
  const bytes = estimateJsonPayloadBytes(payload);
  if (bytes <= MAX_SAFE_PAYLOAD_BYTES) return;

  const label = fileName ? `"${fileName}"` : 'This upload';
  throw new Error(
    `${label} would be too large for the server to accept (about ${(bytes / (1024 * 1024)).toFixed(1)}MB once encoded). The maximum total upload size is ${formatMegabytes(MAX_SAFE_PAYLOAD_BYTES)}. Please use a smaller book file or cover image, or compress the file before trying again.`
  );
}

export const UPLOAD_GUIDELINES = [
  `Each book file: max ${formatMegabytes(MAX_BOOK_FILE_BYTES)} (PDF, EPUB, MOBI, DOC, DOCX).`,
  `Batch upload: up to ${MAX_BATCH_FILES} files, uploaded ${MAX_BATCH_CONCURRENCY} at a time to stay reliable.`,
  'Submissions are reviewed by an admin before appearing in the public library.',
  'Only upload material you have the right to share (no pirated or explicit content).',
  'Reading mode in the browser works best for PDFs; EPUB/MOBI can be downloaded after approval.',
  'Large PDFs over 3MB: compress or split the file before uploading.',
];
