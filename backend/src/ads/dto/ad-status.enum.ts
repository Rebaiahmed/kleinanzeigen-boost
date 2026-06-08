/**
 * Canonical ad status values used across Firestore, the scheduler, and the API.
 * All code should reference this enum instead of raw strings to prevent typos
 * and the previous mixed German/English/casing inconsistency.
 */
export enum AdStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  RESERVED = 'reserviert',
  PENDING = 'pending',
  PENDING_REPOST = 'pending_repost',
}
