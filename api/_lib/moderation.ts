export const MODERATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type ModerationStatus = (typeof MODERATION_STATUS)[keyof typeof MODERATION_STATUS];

/** SQL fragment: only books visible on the public site. */
export const PUBLIC_BOOKS_FILTER = `(moderation_status IS NULL OR moderation_status = '${MODERATION_STATUS.APPROVED}')`;

export function isModerationStatus(value: string): value is ModerationStatus {
  return value === MODERATION_STATUS.PENDING || value === MODERATION_STATUS.APPROVED || value === MODERATION_STATUS.REJECTED;
}
