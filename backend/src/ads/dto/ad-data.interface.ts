import { AdStatus } from './ad-status.enum';

/**
 * Shape of an ad document stored in Firestore (users/{userId}/ads/{adId}).
 * Fields are optional because documents may predate newer fields; the index
 * signature tolerates extra/legacy fields without losing type safety on the
 * ones the scheduler and services actually rely on.
 */
export interface AdData {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  price?: string;

  status?: AdStatus | string;
  autoRepost?: boolean;
  repostIntervalMinutes?: number;
  nextRepostAt?: string | null;
  lastPostedAt?: string | null;
  pendingRepostSince?: string | null;

  // Failure tracking
  repostFailureCount?: number;
  repostDisabledReason?: string | null;
  repostDisabledAt?: string | null;

  // Analytics
  trackedRepostsCount?: number;
  lastRepostViewsGained?: number;
  bestDayBisher?: string;
  bestHourBisher?: number;

  [key: string]: any;
}
