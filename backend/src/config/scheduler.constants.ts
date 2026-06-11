/**
 * Scheduler tunables. Defaults can be overridden via environment variables
 * so behaviour can be adjusted per-environment without code changes.
 */
export const SCHEDULER_CONFIG = {
  /** Repost interval used when an ad has none set (24h). */
  defaultRepostIntervalMinutes: Number(process.env.DEFAULT_REPOST_INTERVAL_MINUTES) || 1440,

  /** How long an ad may sit in PENDING_REPOST before stuck-task recovery reverts it. */
  stuckTaskThresholdMinutes: Number(process.env.STUCK_TASK_THRESHOLD_MINUTES) || 10,

  /** Consecutive repost failures before auto-repost is disabled for an ad. */
  maxRepostFailures: Number(process.env.MAX_REPOST_FAILURES) || 3,

  /** How many users are processed concurrently per cron tick. */
  userConcurrency: Number(process.env.SCHEDULER_USER_CONCURRENCY) || 5,

  /** Delay between sequential scrape-views calls in view tracking, to avoid rate limits. */
  scrapeDelayMs: Number(process.env.SCRAPE_VIEWS_DELAY_MS) || 300,

  /**
   * When a repost hits IP_BLOCKED, pause ALL of that user's reposts for this
   * many hours (global cooldown) instead of hammering their remaining ads and
   * worsening the block. Reposts resume automatically after the window.
   */
  ipBlockCooldownHours: Number(process.env.IP_BLOCK_COOLDOWN_HOURS) || 6,
};
