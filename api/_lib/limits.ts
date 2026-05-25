/** Per-file limit (Vercel serverless request body ~4.5MB including base64 overhead). */
export const MAX_BOOK_FILE_BYTES = 3 * 1024 * 1024;

/** Cover images embedded in JSON must stay small. */
export const MAX_COVER_BYTES = 512 * 1024;

export const MAX_BATCH_FILES = 10;

export const MAX_BATCH_CONCURRENCY = 2;

export const MAX_TEXT_FIELD_LENGTH = 500;

export const MAX_DESCRIPTION_LENGTH = 4000;

export const MAX_PAGE_SIZE = 50;

export const ALLOWED_BOOK_EXTENSIONS = new Set(['pdf', 'epub', 'mobi', 'doc', 'docx']);

export const ALLOWED_BOOK_MIME_PREFIXES = [
  'application/pdf',
  'application/epub',
  'application/epub+zip',
  'application/x-mobipocket-ebook',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
