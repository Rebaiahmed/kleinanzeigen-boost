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
  if (/ip_blocked|ungewöhnliche|unusual activity|temporarily blocked|429|too many requests|rate.?limit|gesperrt/.test(m))
    return 'IP_BLOCKED';
  if (/timeout|timed out|navigation timeout|net::/.test(m)) return 'TIMEOUT';
  if (m.includes('still live')) return 'VERIFICATION_FAILED';
  return 'UNKNOWN';
}
