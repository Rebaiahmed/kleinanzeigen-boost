/**
 * Classify a repost/automation error into a stable code so failures are
 * traceable and groupable (in logs, repostLogs, and run summaries) rather than
 * buried in free-text messages. Shared by the scheduler (auto-repost) and the
 * ads service (manual repost).
 */
export function classifyRepostError(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('session_expired')) return 'SESSION_EXPIRED';
  if (m.includes('captcha')) return 'CAPTCHA_DETECTED';
  if (m.includes('404_not_found')) return '404_NOT_FOUND';
  if (m.includes('403_forbidden')) return '403_FORBIDDEN';
  if (m.includes('ip_rate_limited') || m.includes('429')) return 'IP_RATE_LIMITED';
  if (/ip_blocked|ungewöhnliche|unusual activity|temporarily blocked|too many requests|rate.?limit|gesperrt/.test(m))
    return 'IP_BLOCKED';
  if (/timeout|timed out|navigation timeout|net::/.test(m)) return 'TIMEOUT';
  if (m.includes('still live')) return 'VERIFICATION_FAILED';
  return 'UNKNOWN';
}
