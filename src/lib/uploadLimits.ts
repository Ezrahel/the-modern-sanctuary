export const MAX_BOOK_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_COVER_BYTES = 512 * 1024;
export const MAX_BATCH_FILES = 10;
export const MAX_BATCH_CONCURRENCY = 2;
export const ALLOWED_BOOK_ACCEPT =
  '.pdf,.epub,.mobi,.doc,.docx,application/pdf,application/epub+zip,application/x-mobipocket-ebook,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export const UPLOAD_GUIDELINES = [
  `Each book file: max ${formatMegabytes(MAX_BOOK_FILE_BYTES)} (PDF, EPUB, MOBI, DOC, DOCX).`,
  `Batch upload: up to ${MAX_BATCH_FILES} files, uploaded ${MAX_BATCH_CONCURRENCY} at a time to stay reliable.`,
  'Submissions are reviewed by an admin before appearing in the public library.',
  'Only upload material you have the right to share (no pirated or explicit content).',
  'Reading mode in the browser works best for PDFs; EPUB/MOBI can be downloaded after approval.',
  'Large PDFs over 3MB: compress or split the file before uploading.',
];
