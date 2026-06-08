import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';
import { SessionService } from '../auth/session.service';
import { AdStatus } from '../ads/dto/ad-status.enum';
import { AdData } from '../ads/dto/ad-data.interface';
import { SCHEDULER_CONFIG } from '../config/scheduler.constants';

/** Consistent context prefix for scheduler logs: "[user=… ad=…]". */
function logCtx(userId: string, adId?: string): string {
  return adId ? `[user=${userId} ad=${adId}]` : `[user=${userId}]`;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService,
    private readonly sessionService: SessionService,
  ) {}

  async triggerNow() {
    this.logger.log('⚡ Manual trigger invoked');
    return this.handleRepostCron('manual');
  }

  /**
   * Scrapes an ad's view count with up to 3 attempts and exponential backoff
   * (1s, 2s, 4s). Returns the view count on success, or null if every attempt
   * fails — callers must distinguish null (scrape failed) from 0 (real value)
   * to avoid corrupting analytics.
   */
  private async scrapeViewsWithRetry(
    userId: string,
    cookies: any[],
    adId: string,
    label: string,
  ): Promise<number | null> {
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.automationService.callAutomationWorker('scrape-views', { userId, cookies, adId });
        if (result.success && typeof result.views === 'number') {
          return result.views;
        }
        throw new Error(result.error || 'scrape-views returned no view count');
      } catch (e: any) {
        if (attempt === MAX_ATTEMPTS) {
          this.logger.warn(`${label} for ${adId} failed after ${MAX_ATTEMPTS} attempts: ${e.message}`);
          return null;
        }
        const backoffMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        this.logger.warn(`${label} for ${adId} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${e.message}. Retrying in ${backoffMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
    return null;
  }

  /**
   * Confirms whether a session is genuinely expired before halting a user's
   * whole batch. A single SESSION_EXPIRED from the worker can be a false
   * positive (garbled response, transient worker hiccup); halting on it would
   * skip the user's other still-valid ads.
   *
   * Note: Kleinanzeigen sessions cannot be refreshed server-side — the cookies
   * come from the extension handshake. So this re-fetches the freshest cookies
   * (in case the user re-logged in via the extension) and does one lightweight
   * validation call. Returns true only when expiry is confirmed.
   */
  private async confirmSessionExpired(userId: string, adId: string): Promise<boolean> {
    const freshCookies = await this.sessionService.getDecryptedCookies(userId);
    if (freshCookies.length === 0) return true; // no cookies at all — definitely gone

    try {
      const result = await this.automationService.callAutomationWorker('scrape-views', { userId, cookies: freshCookies, adId });
      // Any non-erroring response means the session still authenticates.
      if (result && (result.success || typeof result.views === 'number')) {
        return false;
      }
      // Ambiguous response — don't confirm expiry, treat as transient.
      return false;
    } catch (e: any) {
      // Only a repeated SESSION_EXPIRED confirms the session is truly dead.
      // Other errors (network/timeout) are transient — don't halt the batch.
      return e.message === 'SESSION_EXPIRED';
    }
  }

  async getStatus() {
    const db = this.firebaseService.firestore;
    const doc = await db.collection('meta').doc('schedulerMeta').get();
    return {
      lastRunAt: doc.data()?.lastRunAt || null,
      lastRepostAt: doc.data()?.lastRepostAt || null,
      totalRepostsAllTime: doc.data()?.totalRepostsAllTime || 0,
    };
  }

  @Cron('*/15 * * * *') // Runs every 15 minutes in production
  async handleRepostCron(triggeredBy: 'cron' | 'manual' = 'cron') {
    this.logger.log(`Running scheduled repost check... (triggeredBy=${triggeredBy})`);
    const db = this.firebaseService.firestore;
    const now = new Date().toISOString();

    try {
      await db.collection('meta').doc('schedulerMeta').set({
        lastRunAt: now
      }, { merge: true });
    } catch (e: any) {
      this.logger.warn(`Failed to update schedulerMeta: ${e.message}`);
    }

    try {
      // ── Stuck-task recovery ──────────────────────────────────────────────────
      // Ads can get stuck in AdStatus.PENDING_REPOST if the worker crashes mid-task.
      // Any ad that has been in that state for more than 10 minutes is reverted
      // back to 'active' so the next cron tick can retry it.
      const stuckCutoff = new Date(Date.now() - SCHEDULER_CONFIG.stuckTaskThresholdMinutes * 60 * 1000).toISOString();
      try {
        const usersForRecovery = await db.collection('users').get();
        for (const userDoc of usersForRecovery.docs) {
          const stuckAds = await db
            .collection('users').doc(userDoc.id).collection('ads')
            .where('status', '==', AdStatus.PENDING_REPOST)
            .where('pendingRepostSince', '<=', stuckCutoff)
            .get();

          for (const stuckAd of stuckAds.docs) {
            this.logger.warn(`${logCtx(userDoc.id, stuckAd.id)} Recovering stuck ad`);
            await stuckAd.ref.update({ status: AdStatus.ACTIVE, pendingRepostSince: null });
          }
        }
      } catch (e: any) {
        this.logger.warn(`Stuck-task recovery failed: ${e.message}`);
      }
      // ─────────────────────────────────────────────────────────────────────────

      // Find all users, skipping those whose marketplace session is known-expired —
      // every repost would fail with SESSION_EXPIRED until they re-login via the extension.
      const usersSnapshot = await db.collection('users').get();
      const activeUserDocs = usersSnapshot.docs.filter(d => d.data()?.accountStatus !== 'expired');
      const skipped = usersSnapshot.docs.length - activeUserDocs.length;
      if (skipped > 0) {
        this.logger.log(`Skipping ${skipped} user(s) with expired session`);
      }

      // Process up to N users concurrently — automation tasks can take 120s each,
      // so serial processing would block for minutes with many users.
      const USER_CONCURRENCY = SCHEDULER_CONFIG.userConcurrency;
      const userChunks: (typeof activeUserDocs[number])[][] = [];
      for (let i = 0; i < activeUserDocs.length; i += USER_CONCURRENCY) {
        userChunks.push(activeUserDocs.slice(i, i + USER_CONCURRENCY));
      }

      for (const chunk of userChunks) {
        await Promise.all(chunk.map(userDoc => this.processUserReposts(userDoc.id, now, triggeredBy)));
      }
    } catch (error: any) {
      this.logger.error(`Cron iteration failed: ${error.message}`);
    }
  }

  /**
   * Processes all due reposts for a single user.
   * Extracted from the cron loop so it can run concurrently across users.
   */
  private async processUserReposts(userId: string, now: string, triggeredBy: 'cron' | 'manual' = 'cron'): Promise<void> {
    const db = this.firebaseService.firestore;

    // Find due ads for this user
    const adsSnapshot = await db.collection('users').doc(userId).collection('ads')
      .where('autoRepost', '==', true)
      .where('nextRepostAt', '<=', now)
      .where('status', '==', AdStatus.ACTIVE)
      .get();

    if (adsSnapshot.empty) return;

    // Fetch decrypted session cookies for view scraping
    const cookies = await this.sessionService.getDecryptedCookies(userId);

    for (const adDoc of adsSnapshot.docs) {
      const adId = adDoc.id;
      const adData = adDoc.data() as AdData;
      const repostIntervalMinutes: number = adData.repostIntervalMinutes ?? SCHEDULER_CONFIG.defaultRepostIntervalMinutes;

      this.logger.log(`${logCtx(userId, adId)} Initiating automated repost`);

      // 1. Atomic state lock — also stamp time so stuck-task recovery can detect it
      await db.runTransaction(async (t) => {
        const ref = db.collection('users').doc(userId).collection('ads').doc(adId);
        t.update(ref, { status: AdStatus.PENDING_REPOST, pendingRepostSince: new Date().toISOString() });
      });

      // 2. Fetch viewsBefore (retries with backoff; null = scrape failed, not 0 views)
      let viewsBefore: number | null = null;
      if (cookies.length > 0) {
        viewsBefore = await this.scrapeViewsWithRetry(userId, cookies, adId, 'viewsBefore');
      }

      const startTime = Date.now();

      // 3. Trigger worker
      try {
        const result = await this.automationService.callAutomationWorker('repost', { userId, adId, adData });

        // 4. On success, update state and create log
        if (result.success) {
          const nextRepostAt = new Date(Date.now() + repostIntervalMinutes * 60 * 1000).toISOString();

          await db.collection('users').doc(userId).collection('ads').doc(adId).update({
            status: AdStatus.ACTIVE,
            lastPostedAt: new Date().toISOString(),
            nextRepostAt,
            pendingRepostSince: null,
            repostFailureCount: 0,        // reset on success
            repostDisabledReason: null,
          });

          await db.collection('users').doc(userId).collection('ads').doc(adId).collection('repostLogs').add({
            status: 'success',
            executedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            viewsBefore,
            viewsAfter: null,
            triggeredBy,
          });

          this.logger.log(`${logCtx(userId, adId)} Repost scheduled: next in ${repostIntervalMinutes} minutes`);
        }
      } catch (error: any) {
        this.logger.error(`${logCtx(userId, adId)} Repost failed: ${error.message}`);

        const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);

        if (error.message === 'SESSION_EXPIRED') {
          // Confirm before halting — a single SESSION_EXPIRED can be a false positive.
          const reallyExpired = await this.confirmSessionExpired(userId, adId);
          await adRef.update({ status: AdStatus.ACTIVE, pendingRepostSince: null });

          if (reallyExpired) {
            await db.collection('users').doc(userId).update({ accountStatus: 'expired' });
            this.logger.warn(`${logCtx(userId)} Session confirmed expired — halting remaining reposts`);
            break; // All ads share these cookies; no point continuing.
          }

          // False positive — session still authenticates. Skip this ad, keep going.
          this.logger.warn(`${logCtx(userId, adId)} SESSION_EXPIRED not confirmed on re-check — continuing with other ads`);
          continue;
        }

        // Track consecutive failures per ad. After N, disable auto-repost and notify.
        const MAX_REPOST_FAILURES = SCHEDULER_CONFIG.maxRepostFailures;
        const failureCount = (adData.repostFailureCount || 0) + 1;

        if (failureCount >= MAX_REPOST_FAILURES) {
          await adRef.update({
            status: AdStatus.ACTIVE,
            pendingRepostSince: null,
            autoRepost: false,
            repostFailureCount: failureCount,
            repostDisabledReason: `Auto-Repost nach ${MAX_REPOST_FAILURES} Fehlversuchen automatisch deaktiviert. Letzter Fehler: ${error.message}`,
            repostDisabledAt: new Date().toISOString(),
            nextRepostAt: null,
          });

          // Write a notification the dashboard can surface
          try {
            await db.collection('users').doc(userId).collection('notifications').add({
              type: 'repost_disabled',
              adId,
              adTitle: adData.title || 'Anzeige',
              message: `Auto-Repost für "${adData.title || 'deine Anzeige'}" wurde nach ${MAX_REPOST_FAILURES} fehlgeschlagenen Versuchen deaktiviert. Bitte prüfe die Anzeige und aktiviere sie erneut.`,
              read: false,
              createdAt: new Date().toISOString(),
            });
          } catch (notifyErr: any) {
            this.logger.warn(`Failed to write notification for ${adId}: ${notifyErr.message}`);
          }

          this.logger.warn(`${logCtx(userId, adId)} Auto-Repost disabled after ${MAX_REPOST_FAILURES} failures`);
        } else {
          await adRef.update({
            status: AdStatus.ACTIVE,
            pendingRepostSince: null,
            repostFailureCount: failureCount,
          });
          this.logger.warn(`${logCtx(userId, adId)} Repost failure ${failureCount}/${MAX_REPOST_FAILURES}`);
        }
      }
    }
  }

  @Cron('0 * * * *') // Runs every hour
  async trackRepostViews() {
    this.logger.log('Running view tracking cron...');
    const db = this.firebaseService.firestore;
    const now = new Date();
    const targetDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      const usersSnapshot = await db.collection('users').get();
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;

        // Fetch decrypted session cookies once per user
        const cookies = await this.sessionService.getDecryptedCookies(userId);
        if (cookies.length === 0) continue;

        const adsSnapshot = await db.collection('users').doc(userId).collection('ads').get();
        for (const adDoc of adsSnapshot.docs) {
          const adId = adDoc.id;

          const logsSnapshot = await db.collection('users').doc(userId).collection('ads').doc(adId).collection('repostLogs')
            .where('viewsAfter', '==', null)
            .get();

          for (const logDoc of logsSnapshot.docs) {
            const logData = logDoc.data();
            const executedAt = new Date(logData.executedAt);

            // Check if it has been 24 hours
            if (executedAt <= targetDate) {
              try {
                const viewsAfter = await this.scrapeViewsWithRetry(userId, cookies, adId, 'viewsAfter');
                // Skip if the after-scrape failed, or if viewsBefore was never captured —
                // computing a "gained" delta from a missing baseline would corrupt analytics.
                if (viewsAfter !== null && typeof logData.viewsBefore === 'number') {
                  const viewsBefore = logData.viewsBefore;
                  const viewsGained = Math.max(0, viewsAfter - viewsBefore);

                  await logDoc.ref.update({
                    viewsAfter,
                    viewsGained,
                  });

                  // Incrementally update ad stats — avoids re-fetching all logs.
                  // trackedRepostsCount and lastRepostViewsGained are maintained in-place.
                  // bestDayBisher/bestHourBisher are only updated if this log beats the current best.
                  try {
                    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
                    const adSnap = await adRef.get();
                    const adD = adSnap.data() || {};

                    const deDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
                    const executedDate = new Date(logData.executedAt);
                    const statsUpdate: Record<string, any> = {
                      trackedRepostsCount: (adD.trackedRepostsCount || 0) + 1,
                      lastRepostViewsGained: viewsGained,
                    };

                    // Update best day/hour only when this log beats the stored best
                    if (viewsGained > (adD.bestViewsGained || 0)) {
                      statsUpdate.bestViewsGained = viewsGained;
                      statsUpdate.bestDayBisher = deDays[executedDate.getDay()];
                      statsUpdate.bestHourBisher = executedDate.getHours();
                    }

                    await adRef.update(statsUpdate);
                  } catch (e: any) {
                    this.logger.warn(`Failed to update stats for ad ${adId}: ${e.message}`);
                  }

                  this.logger.log(`Updated views for repostLog ${logDoc.id} of ad ${adId}: +${viewsGained} views`);
                }
              } catch (e: any) {
                this.logger.warn(`${logCtx(userId, adId)} Failed to track views: ${e.message}`);
              }
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`View tracking cron failed: ${error.message}`);
    }
  }
}
