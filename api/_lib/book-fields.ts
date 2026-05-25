import xss from 'xss';
import { MODERATION_STATUS, type ModerationStatus } from './moderation';

export const BOOK_LIST_COLUMNS = `
  id, title, author, category, cover, rating, pages, format, uploader, description,
  file_name, file_type, file_size, date_added,
  moderation_status, moderation_note, reviewed_at, reviewed_by,
  file_data IS NOT NULL AS has_file
`;

export function mapBookRow(row: Record<string, unknown>) {
  return {
    ...row,
    has_file: row.has_file ?? false,
  };
}

export function sanitizeBookInput(input: Record<string, unknown>) {
  return {
    title: xss(String(input.title ?? '')),
    author: xss(String(input.author ?? '')),
    category: xss(String(input.category ?? '')),
    description: xss(String(input.description ?? '')),
    format: xss(String(input.format ?? '')),
    cover: xss(String(input.cover ?? '')),
    uploader: xss(String(input.uploader ?? 'Community User')),
    fileName: xss(String(input.fileName ?? input.file_name ?? '')),
    fileType: xss(String(input.fileType ?? input.file_type ?? 'application/octet-stream')),
    fileData: input.fileData != null ? String(input.fileData) : input.file_data != null ? String(input.file_data) : undefined,
    rating: input.rating != null ? parseFloat(String(input.rating)) : undefined,
    pages: input.pages != null ? parseInt(String(input.pages), 10) : undefined,
    fileSize: input.fileSize != null ? parseInt(String(input.fileSize), 10) : input.file_size != null ? parseInt(String(input.file_size), 10) : undefined,
    moderationStatus: input.moderationStatus ?? input.moderation_status,
    moderationNote: input.moderationNote ?? input.moderation_note,
  };
}

export function parseModerationStatus(value: unknown, fallback: ModerationStatus = MODERATION_STATUS.PENDING): ModerationStatus {
  const raw = String(value ?? fallback).toLowerCase();
  if (raw === MODERATION_STATUS.APPROVED || raw === MODERATION_STATUS.REJECTED || raw === MODERATION_STATUS.PENDING) {
    return raw;
  }
  return fallback;
}
