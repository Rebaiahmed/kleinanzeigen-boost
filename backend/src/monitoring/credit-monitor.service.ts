import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

/**
 * Periodically checks the OpenRouter credit balance and alerts (via a webhook you
 * configure) when it's running low or the key is invalid — so the AI never
 * silently goes "ausgelastet" mid-use without warning.
 *
 * Env:
 *   OPENROUTER_API_KEY                 — the key whose balance to check (required)
 *   ALERT_WEBHOOK_URL                  — Slack/Discord/Telegram-style incoming webhook (optional)
 *   OPENROUTER_LOW_CREDIT_USD          — threshold in USD (default 2)
 */
@Injectable()
export class CreditMonitorService {
  private readonly logger = new Logger(CreditMonitorService.name);
  private readonly threshold = Number(process.env.OPENROUTER_LOW_CREDIT_USD) || 2;
  // Re-alert at most once/day while still low; reset once credit recovers.
  private lastAlertAt = 0;
  private readonly reAlertMs = 24 * 60 * 60 * 1000;

  @Cron(CronExpression.EVERY_6_HOURS)
  async checkCredit(): Promise<void> {
    const key = process.env.OPENROUTER_API_KEY?.trim();
    if (!key) return; // AI not configured — nothing to monitor

    let remaining: number | null = null;
    try {
      // /key gives the per-key limit_remaining (what the app actually spends against).
      const res = await axios.get('https://openrouter.ai/api/v1/key', {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 10000,
      });
      const data = res.data?.data || {};
      if (typeof data.limit_remaining === 'number') {
        remaining = data.limit_remaining;
      } else {
        // No per-key cap → fall back to the account balance.
        const credits = await axios.get('https://openrouter.ai/api/v1/credits', {
          headers: { Authorization: `Bearer ${key}` },
          timeout: 10000,
        });
        const c = credits.data?.data || {};
        remaining = (Number(c.total_credits) || 0) - (Number(c.total_usage) || 0);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      // 401 = the key itself is bad → alert (this is the "invalid key" failure mode).
      await this.alert(
        `⚠️ OpenRouter-Schlüssel-Prüfung fehlgeschlagen (HTTP ${status || '?'}): ${err?.message}. KI-Funktionen könnten ausfallen.`,
        true,
      );
      return;
    }

    if (remaining === null) return;
    this.logger.log(`[credit] OpenRouter remaining ≈ $${remaining.toFixed(2)} (threshold $${this.threshold})`);

    if (remaining < this.threshold) {
      await this.alert(
        `⚠️ OpenRouter-Guthaben niedrig: nur noch ≈ $${remaining.toFixed(2)} übrig (Schwelle $${this.threshold}). Bitte aufladen, sonst fallen die KI-Funktionen aus.`,
        false,
      );
    } else {
      this.lastAlertAt = 0; // recovered → allow the next low event to alert immediately
    }
  }

  /** Best-effort alert: posts to ALERT_WEBHOOK_URL (if set) + logs. De-duped to
   *  once/day unless `force` (e.g. an invalid-key error). Never throws. */
  private async alert(message: string, force: boolean): Promise<void> {
    // Forced alerts (e.g. invalid-key errors) always fire and must NOT touch
    // lastAlertAt — that timer belongs solely to the low-credit de-dupe, and
    // letting a forced alert reset it would delay the next legitimate
    // low-credit alert by up to a full day.
    if (!force) {
      const now = Date.now();
      if (now - this.lastAlertAt < this.reAlertMs) return;
      this.lastAlertAt = now;
    }

    this.logger.error(`[credit] ${message}`);

    const url = process.env.ALERT_WEBHOOK_URL?.trim();
    if (!url) return;
    try {
      // `text` (Slack) and `content` (Discord) — each service reads its own key.
      await axios.post(url, { text: message, content: message }, { timeout: 8000 });
    } catch (e: any) {
      this.logger.warn(`[credit] alert webhook failed: ${e?.message}`);
    }
  }
}
