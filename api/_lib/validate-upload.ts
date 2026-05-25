import {
  ALLOWED_BOOK_EXTENSIONS,
  ALLOWED_BOOK_MIME_PREFIXES,
  MAX_BOOK_FILE_BYTES,
  MAX_COVER_BYTES,
  MAX_DESCRIPTION_LENGTH,
  MAX_TEXT_FIELD_LENGTH,
} from './limits';

export function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

export function isAllowedBookFile(fileName: string, fileType?: string): boolean {
  const ext = getExtension(fileName);
  if (!ALLOWED_BOOK_EXTENSIONS.has(ext)) {
    return false;
  }
  if (!fileType) return true;
  const mime = fileType.toLowerCase();
  return ALLOWED_BOOK_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix) || mime.includes(prefix));
}

export function validateBookFileSize(fileSize: number): string | null {
  if (!Number.isFinite(fileSize) || fileSize < 1) {
    return 'Book file is empty or invalid.';
  }
  if (fileSize > MAX_BOOK_FILE_BYTES) {
    return `Book file must be ${MAX_BOOK_FILE_BYTES / (1024 * 1024)}MB or smaller.`;
  }
  return null;
}

export function validateCoverPayload(cover: string | undefined): string | null {
  if (!cover) return null;
  if (cover.startsWith('http://') || cover.startsWith('https://') || cover.startsWith('/')) {
    if (cover.length > 2000) return 'Cover URL is too long.';
    return null;
  }
  if (cover.startsWith('data:')) {
    const approxBytes = Math.ceil((cover.length * 3) / 4);
    if (approxBytes > MAX_COVER_BYTES) {
      return `Cover image must be ${MAX_COVER_BYTES / 1024}KB or smaller.`;
    }
    return null;
  }
  return null;
}

export function clampTextFields(fields: {
  title?: string;
  author?: string;
  category?: string;
  description?: string;
  uploader?: string;
}) {
  return {
    title: (fields.title || '').slice(0, MAX_TEXT_FIELD_LENGTH),
    author: (fields.author || '').slice(0, MAX_TEXT_FIELD_LENGTH),
    category: (fields.category || '').slice(0, MAX_TEXT_FIELD_LENGTH),
    description: (fields.description || '').slice(0, MAX_DESCRIPTION_LENGTH),
    uploader: (fields.uploader || 'Community User').slice(0, MAX_TEXT_FIELD_LENGTH),
  };
}

export function validateBookUploadInput(input: {
  fileName: string;
  fileType?: string;
  fileSize: number;
  fileData: string;
  cover?: string;
}): string | null {
  if (!isAllowedBookFile(input.fileName, input.fileType)) {
    return 'Only PDF, EPUB, MOBI, DOC, and DOCX files are allowed.';
  }
  const sizeError = validateBookFileSize(input.fileSize);
  if (sizeError) return sizeError;
  if (!input.fileData.startsWith('data:')) {
    return 'Invalid book file payload.';
  }
  const coverError = validateCoverPayload(input.cover);
  if (coverError) return coverError;
  return null;
}
