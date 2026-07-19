import axios from 'axios';
import { Logger } from '@nestjs/common';

const logger = new Logger('AdminAlert');

/**
 * Best-effort admin alert: posts to ALERT_WEBHOOK_URL (if set) + logs.
 * Never throws — used from webhook handlers where a failed alert must not
 * block the 200 response back to Stripe. Shares the same env var and
 * Slack/Discord-compatible payload shape as
 * monitoring/credit-monitor.service.ts's private alert() — pulled out here
 * so Stripe refund/dispute handling can reuse it without depending on that
 * service.
 */
export async function sendAdminAlert(message: string): Promise<void> {
  logger.error(message);
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    await axios.post(url, { text: message, content: message }, { timeout: 8000 });
  } catch (e: any) {
    logger.warn(`alert webhook failed: ${e?.message}`);
  }
}
