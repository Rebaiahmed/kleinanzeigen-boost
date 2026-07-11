import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';
import { SessionService } from '../auth/session.service';
import { AdStatus } from '../ads/dto/ad-status.enum';
import { AdData } from '../ads/dto/ad-data.interface';
import { SCHEDULER_CONFIG } from '../config/scheduler.constants';
import { applySmartVariation, computeNextSmartRepost } from '../config/smart-repost';
import { classifyRepostError } from '../common/repost-error.util';
import { NotificationsService } from '../notifications/notifications.service';
import { WettbewerbService } from '../wettbewerb/wettbewerb.service';
import { FEATURE_FLAGS } from '../config/feature-flags';

/** Consistent context prefix for scheduler logs: "[run=… user=… ad=…]". */
function logCtx(userId?: string, adId?: string, runId?: string): string {
  const parts: string[] = [];
  if (runId) parts.push(`run=${runId}`);
  if (userId) parts.push(`user=${userId}`);
  if (adId) parts.push(`ad=${adId}`);
  return `[${parts.join(' ')}]`;
}

/** Aggregated counters for one cron run — persisted as the run summary. */
interface RunStats {
  due: number;
  succeeded: number;
  failed: number;
  skippedUsers: number;
  errorsByCode: Record<string, number>;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  /** Guards against overlapping runs when a cron tick takes longer than the interval. */
  private isRunning = false;

  /** Separate mutex for the Wettbewerb recheck cron — independent run cadence from repost. */
  private wettbewerbCronRunning = false;

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService,
    private readonly sessionService: SessionService,
    private readonly notificationsService: NotificationsService,
    private readonly wettbewerbService: WettbewerbService,
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
      lastRun: doc.data()?.lastRun || null, // { runId, triggeredBy, due, succeeded, failed, errorsByCode, durationMs }
    };
  }

  /** Get all scheduled (pending) one-time reposts for a user. */
  async getUserScheduledReposts(userId: string) {
    const db = this.firebaseService.firestore;
    const snap = await db.collection('users').doc(userId).collection('ads')
      .where('autoRepost', '==', true)
      .where('status', '==', AdStatus.ACTIVE)
      .get();

    const now = new Date().toISOString();
    const scheduled = snap.docs
      .map(d => {
        const ad: any = d.data();
        return {
          id: d.id,
          title: ad.title || '(Untitled)',
          nextRepostAt: ad.nextRepostAt || null,
          isDueNow: ad.nextRepostAt && ad.nextRepostAt <= now ? true : false,
          listingState: ad.listingState || 'unknown',
        };
      })
      .sort((a, b) => {
        const aTime = a.nextRepostAt ? new Date(a.nextRepostAt).getTime() : Infinity;
        const bTime = b.nextRepostAt ? new Date(b.nextRepostAt).getTime() : Infinity;
        return aTime - bTime;
      });

    return { success: true, now, count: scheduled.length, scheduled };
  }

  // Every 15 min in production; every 30 seconds in SIMULATE mode for better granularity
  // (so 5/10 min test intervals don't miss the scheduler window)
  @Cron(process.env.REPOST_SIMULATE === 'true' ? '*/1 * * * *' : '*/15 * * * *')
  async handleRepostCron(triggeredBy: 'cron' | 'manual' = 'cron') {
    // Kill-switch: set SCHEDULER_ENABLED=false to stop the server-side cron from
    // calling the automation worker (e.g. while testing the client-side scheduler).
    // A manual trigger ignores the switch on purpose.
    if (triggeredBy === 'cron' && process.env.SCHEDULER_ENABLED === 'false') {
      return { skipped: true, reason: 'scheduler_disabled' };
    }

    // Mutex: if a previous run is still in progress (e.g. many slow worker calls),
    // skip this tick rather than processing the same due ads twice concurrently.
    if (this.isRunning) {
      this.logger.warn(`Repost run skipped — previous run still in progress (triggeredBy=${triggeredBy})`);
      return { skipped: true, reason: 'already_running' };
    }
    this.isRunning = true;

    // Correlation id — stamped on every log line, repostLog and the run summary
    // so a whole run can be traced end-to-end.
    const runId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 8);
    const runStartedAt = Date.now();
    const stats: RunStats = { due: 0, succeeded: 0, failed: 0, skippedUsers: 0, errorsByCode: {} };

    this.logger.log(`${logCtx(undefined, undefined, runId)} ▶ Repost run started (triggeredBy=${triggeredBy})`);
    const db = this.firebaseService.firestore;
    const now = new Date().toISOString();

    try {
      await db.collection('meta').doc('schedulerMeta').set({
        lastRunAt: now
      }, { merge: true });
    } catch (e: any) {
      this.logger.warn(`${logCtx(undefined, undefined, runId)} Failed to update schedulerMeta: ${e.message}`);
    }

    try {
      // ── Stuck-task recovery ──────────────────────────────────────────────────
      // Ads can get stuck in AdStatus.PENDING_REPOST if the worker crashes mid-task.
      // One collectionGroup query finds them across all users; reverts are batched.
      const stuckCutoff = new Date(Date.now() - SCHEDULER_CONFIG.stuckTaskThresholdMinutes * 60 * 1000).toISOString();
      try {
        const stuckAds = await db.collectionGroup('ads')
          .where('status', '==', AdStatus.PENDING_REPOST)
          .where('pendingRepostSince', '<=', stuckCutoff)
          .get();

        if (!stuckAds.empty) {
          const batch = db.batch();
          for (const stuckAd of stuckAds.docs) {
            this.logger.warn(`${logCtx(stuckAd.ref.parent.parent?.id, stuckAd.id)} Recovering stuck ad`);
            batch.update(stuckAd.ref, { status: AdStatus.ACTIVE, pendingRepostSince: null });
          }
          await batch.commit();
        }
      } catch (e: any) {
        this.logger.warn(`Stuck-task recovery failed: ${e.message}`);
      }
      // ─────────────────────────────────────────────────────────────────────────

      // SERVER = fallback. Only pick ads still due AFTER the grace window — the
      // client (extension) gets first crack while the browser is open. Ads the
      // client already reposted have nextRepostAt cleared, so they won't appear;
      // ads only reachable here are ones the browser never handled (closed).
      const serverCutoff = new Date(Date.now() - SCHEDULER_CONFIG.serverFallbackGraceMinutes * 60 * 1000).toISOString();

      // One collectionGroup query returns ONLY due ads across all users — avoids
      // the previous N-queries-per-user scan. Requires a composite index on the
      // 'ads' group (autoRepost, status, nextRepostAt) — see firestore.indexes.json.
      const dueAdsSnap = await db.collectionGroup('ads')
        .where('autoRepost', '==', true)
        .where('status', '==', AdStatus.ACTIVE)
        .where('nextRepostAt', '<=', serverCutoff)
        .get();

      if (dueAdsSnap.empty) {
        this.logger.log(`${logCtx(undefined, undefined, runId)} ✓ No due reposts this run`);
        await this.persistRunSummary(runId, triggeredBy, stats, Date.now() - runStartedAt);
        return { skipped: false };
      }

      stats.due = dueAdsSnap.size;

      // Group due ads by their owning user (ad.ref.parent.parent.id).
      const adsByUser = new Map<string, any[]>();
      for (const adDoc of dueAdsSnap.docs) {
        const uid = adDoc.ref.parent?.parent?.id;
        if (!uid) continue;
        (adsByUser.get(uid) ?? adsByUser.set(uid, []).get(uid)!).push(adDoc);
      }

      // Fetch only the user docs that actually have due ads, and skip expired sessions.
      const userIds = [...adsByUser.keys()];
      const activeUserIds: string[] = [];
      const nowMs = Date.now();
      for (const uid of userIds) {
        const userData = (await db.collection('users').doc(uid).get()).data();
        if (userData?.accountStatus === 'expired') continue;
        // Global IP-block cooldown: skip the user entirely until the window passes.
        if (userData?.repostPausedUntil && new Date(userData.repostPausedUntil).getTime() > nowMs) {
          this.logger.warn(`${logCtx(uid, undefined, runId)} Skipped — reposts paused until ${userData.repostPausedUntil} (IP cooldown)`);
          continue;
        }
        activeUserIds.push(uid);
      }
      stats.skippedUsers = userIds.length - activeUserIds.length;
      if (stats.skippedUsers > 0) this.logger.log(`${logCtx(undefined, undefined, runId)} Skipping ${stats.skippedUsers} user(s) with expired session`);

      this.logger.log(`${logCtx(undefined, undefined, runId)} Processing ${stats.due} due ad(s) across ${activeUserIds.length} user(s)`);

      // Process up to N users concurrently — automation tasks can take 120s each.
      const USER_CONCURRENCY = SCHEDULER_CONFIG.userConcurrency;
      for (let i = 0; i < activeUserIds.length; i += USER_CONCURRENCY) {
        const chunk = activeUserIds.slice(i, i + USER_CONCURRENCY);
        await Promise.all(chunk.map(uid => this.processUserReposts(uid, adsByUser.get(uid)!, triggeredBy, runId, stats)));
      }
    } catch (error: any) {
      this.logger.error(`${logCtx(undefined, undefined, runId)} ✗ Cron iteration failed: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }

    const durationMs = Date.now() - runStartedAt;
    const errorsSummary = Object.entries(stats.errorsByCode).map(([c, n]) => `${c}=${n}`).join(' ') || 'none';
    this.logger.log(
      `${logCtx(undefined, undefined, runId)} ■ Repost run finished in ${durationMs}ms — ` +
      `due=${stats.due} ok=${stats.succeeded} failed=${stats.failed} skippedUsers=${stats.skippedUsers} errors[${errorsSummary}]`,
    );
    await this.persistRunSummary(runId, triggeredBy, stats, durationMs);
    return { skipped: false };
  }

  /** Persist a per-run summary so cron history is traceable from Firestore. */
  private async persistRunSummary(
    runId: string,
    triggeredBy: 'cron' | 'manual',
    stats: RunStats,
    durationMs: number,
  ): Promise<void> {
    const db = this.firebaseService.firestore;
    const summary = {
      runId,
      triggeredBy,
      finishedAt: new Date().toISOString(),
      durationMs,
      ...stats,
    };
    try {
      // Latest run on the meta doc (for the dashboard) + an append-only history log.
      await db.collection('meta').doc('schedulerMeta').set({ lastRun: summary }, { merge: true });
      await db.collection('meta').doc('schedulerMeta').collection('runs').doc(runId).set(summary);
    } catch (e: any) {
      this.logger.warn(`${logCtx(undefined, undefined, runId)} Failed to persist run summary: ${e.message}`);
    }
  }

  /**
   * Processes all due reposts for a single user.
   * Extracted from the cron loop so it can run concurrently across users.
   */
  private async processUserReposts(
    userId: string,
    adDocs: any[],
    triggeredBy: 'cron' | 'manual' = 'cron',
    runId?: string,
    stats?: RunStats,
  ): Promise<void> {
    const db = this.firebaseService.firestore;

    if (!adDocs || adDocs.length === 0) return;

    // Fetch decrypted session cookies for view scraping
    const cookies = await this.sessionService.getDecryptedCookies(userId);

    for (const adDoc of adDocs) {
      const adId = adDoc.id;
      const adData = adDoc.data() as AdData;
      const repostIntervalMinutes: number = adData.repostIntervalMinutes ?? SCHEDULER_CONFIG.defaultRepostIntervalMinutes;

      this.logger.log(`${logCtx(userId, adId, runId)} Initiating automated repost`);

      // 1. Atomic state lock — read first so we skip gracefully if the ad was
      //    deleted, or its status/autoRepost changed, between the query and now.
      //    Returns WHY it was skipped so we can stop re-querying ineligible ads
      //    every run (they'd otherwise show up as "due" forever).
      const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
      const lock = await db.runTransaction(async (t): Promise<
        { locked: true } | { locked: false; action: 'clear' | 'snooze' | 'retry' }
      > => {
        const snap = await t.get(adRef);
        if (!snap.exists) return { locked: false, action: 'clear' };          // gone from our DB
        const cur = snap.data() as any;
        if (cur.autoRepost !== true) return { locked: false, action: 'clear' };// recurring turned off
        if (cur.listingState === 'deleted') return { locked: false, action: 'clear' }; // gone on KA
        // Reserved/paused on KA is TEMPORARY — don't clear the schedule, just snooze.
        if (cur.listingState && cur.listingState !== 'active') return { locked: false, action: 'snooze' };
        if (cur.status !== AdStatus.ACTIVE) return { locked: false, action: 'retry' }; // transient (e.g. already pending)
        t.update(adRef, { status: AdStatus.PENDING_REPOST, pendingRepostSince: new Date().toISOString() });
        return { locked: true };
      });

      if (!lock.locked) {
        if (lock.action === 'clear') {
          // Deleted or recurring disabled — stop re-querying it every run.
          await adRef.update({ nextRepostAt: null, autoRepost: false }).catch(() => {});
          this.logger.log(`${logCtx(userId, adId)} Skipped & cleared — deleted/ineligible; auto-repost off`);
        } else if (lock.action === 'snooze') {
          // Paused/reserved on KA: push nextRepostAt forward one interval so it's
          // re-checked later, not every run. Sync flips listingState back to
          // 'active' when the reservation lifts, and reposting resumes.
          const next = new Date(Date.now() + repostIntervalMinutes * 60000).toISOString();
          await adRef.update({ nextRepostAt: next }).catch(() => {});
          this.logger.log(`${logCtx(userId, adId)} Skipped & snoozed — listing not active; re-check ${next}`);
        } else {
          this.logger.log(`${logCtx(userId, adId)} Skipped — transient state, will retry next run`);
        }
        continue;
      }

      // 2. Fetch viewsBefore (retries with backoff; null = scrape failed, not 0 views)
      let viewsBefore: number | null = null;
      if (cookies.length > 0) {
        viewsBefore = await this.scrapeViewsWithRetry(userId, cookies, adId, 'viewsBefore');
      }

      const startTime = Date.now();

      // 3. Run the server-side repost via the automation worker.
      //    RE-ENABLED FOR DIAGNOSIS — actually drives the headless browser so the
      //    worker's [repost-diag] logging captures the 403 cause. callAutomationWorker
      //    throws on failure, which the catch block below classifies + logs.
      try {
        // Smart Repost: apply ONE real micro-variation (title/photo/price) so the
        // refresh registers as a genuine change. The engine is unchanged — it just
        // receives the varied copy. Manual mode posts the ad as-is.
        const isSmart = adData.repostMode === 'smart';
        const repostCount = Number(adData.trackedRepostsCount) || 0;
        const varied = isSmart
          ? applySmartVariation(adData, adData.smartVariation, repostCount)
          : { adData, applied: 'none' as const };
        if (isSmart) this.logger.log(`${logCtx(userId, adId, runId)} Smart Repost — variation applied: ${varied.applied}`);

        const result = await this.automationService.callAutomationWorker('repost', { userId, adId, adData: varied.adData, cookies });
        this.logger.log(`${logCtx(userId, adId, runId)} Automation worker result: ${JSON.stringify(result)}`);

        // 4. On success, update state and create log.
        // RECURRING: reschedule the next occurrence (now + interval) so the ad keeps
        // reposting on its schedule. (The client runs it first when the browser is
        // open; the server only reaches here as the closed-browser fallback.)
        if (result.success) {
          // Smart mode: next repost lands before a browsing peak, ≥7 days out
          // (free-refresh limit). Manual mode: now + chosen interval.
          const next = isSmart
            ? computeNextSmartRepost(Date.now())
            : new Date(Date.now() + (Number(adData.repostIntervalMinutes) || SCHEDULER_CONFIG.defaultRepostIntervalMinutes) * 60 * 1000).toISOString();
          await db.collection('users').doc(userId).collection('ads').doc(adId).update({
            status: AdStatus.ACTIVE,
            lastPostedAt: new Date().toISOString(),
            autoRepost: true,             // keep the recurring schedule active
            nextRepostAt: next,           // schedule the next occurrence
            pendingRepostSince: null,
            repostFailureCount: 0,        // reset on success
            repostDisabledReason: null,
            trackedRepostsCount: repostCount + 1,   // drives variation rotation
            ...(result.newAdId ? { lastRepostNewAdId: result.newAdId } : {}),
            ...(result.newAdUrl ? { lastRepostNewAdUrl: result.newAdUrl } : {}),
          });

          await db.collection('users').doc(userId).collection('ads').doc(adId).collection('repostLogs').add({
            status: 'success',
            executedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            viewsBefore,
            viewsAfter: null,
            triggeredBy,
            runId: runId || null,
            newAdId: result.newAdId || null,
            newAdUrl: result.newAdUrl || null,
            repostMode: isSmart ? 'smart' : 'manual',
            variationApplied: varied.applied,
          });

          if (stats) stats.succeeded++;
          this.logger.log(`${logCtx(userId, adId, runId)} ✓ Repost ok (${isSmart ? 'smart/' + varied.applied : 'manual'}) — next ${next}`);
        }
      } catch (error: any) {
        const errorCode = classifyRepostError(error.message);
        if (stats) {
          stats.failed++;
          stats.errorsByCode[errorCode] = (stats.errorsByCode[errorCode] || 0) + 1;
        }
        this.logger.error(`${logCtx(userId, adId, runId)} ✗ Repost failed [${errorCode}]: ${error.message}`);

        // adRef is declared at the top of this loop iteration.
        // Always record the failure in the ad's repostLogs for traceability.
        await adRef.collection('repostLogs').add({
          status: 'failed',
          errorCode,
          error: (error.message || 'unknown').slice(0, 500),
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          viewsBefore,
          triggeredBy,
          runId: runId || null,
        }).catch((e: any) => this.logger.warn(`${logCtx(userId, adId, runId)} Failed to write failure log: ${e.message}`));

        // IP_BLOCKED: stop hammering — pause ALL of this user's reposts for a
        // cooldown window and bail out of their batch immediately.
        if (errorCode === 'IP_BLOCKED') {
          const cooldownMs = SCHEDULER_CONFIG.ipBlockCooldownHours * 60 * 60 * 1000;
          const pausedUntil = new Date(Date.now() + cooldownMs).toISOString();
          await adRef.update({ status: AdStatus.ACTIVE, pendingRepostSince: null }).catch(() => {});
          await db.collection('users').doc(userId).set({ repostPausedUntil: pausedUntil }, { merge: true }).catch(() => {});
          await this.notificationsService.emit(userId, {
            type: 'reposts_paused',
            message: `Reposts pausiert: Kleinanzeigen hat ungewöhnliche Aktivität erkannt. Wir versuchen es automatisch in ${SCHEDULER_CONFIG.ipBlockCooldownHours} Stunden erneut.`,
          }).catch(() => {});
          this.logger.warn(`${logCtx(userId, adId, runId)} IP_BLOCKED — pausing all reposts for ${SCHEDULER_CONFIG.ipBlockCooldownHours}h (until ${pausedUntil})`);
          break; // shared IP/session — don't touch this user's other ads
        }

        if (error.message === 'SESSION_EXPIRED') {
          // Confirm before halting — a single SESSION_EXPIRED can be a false positive.
          const reallyExpired = await this.confirmSessionExpired(userId, adId);
          await adRef.update({ status: AdStatus.ACTIVE, pendingRepostSince: null });

          if (reallyExpired) {
            await db.collection('users').doc(userId).update({ accountStatus: 'expired' });
            this.logger.warn(`${logCtx(userId, undefined, runId)} Session confirmed expired — halting remaining reposts`);
            break; // All ads share these cookies; no point continuing.
          }

          // False positive — session still authenticates. Skip this ad, keep going.
          this.logger.warn(`${logCtx(userId, adId, runId)} SESSION_EXPIRED not confirmed on re-check — continuing with other ads`);
          continue;
        }

        // Track consecutive failures per ad. After N, disable auto-repost and notify.
        const MAX_REPOST_FAILURES = SCHEDULER_CONFIG.maxRepostFailures;
        const failureCount = (adData.repostFailureCount || 0) + 1;

        // Build user-friendly error message
        const errorMessages: Record<string, string> = {
          SESSION_EXPIRED: 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.',
          IP_BLOCKED: 'Dein IP wurde vorübergehend gesperrt. Versuche es später erneut.',
          CAPTCHA_DETECTED: 'CAPTCHA erkannt. Bitte melde dich manuell an.',
          TIMEOUT: 'Zeitüberschreitung beim Neuposten. Das Netzwerk ist möglicherweise langsam.',
          VERIFICATION_FAILED: 'Die Anzeige wurde gelöscht oder ist nicht mehr live.',
          UNKNOWN: 'Unbekannter Fehler beim Neuposten.',
        };

        const userFriendlyMessage = errorMessages[errorCode] || `Fehler: ${error.message}`;

        if (failureCount >= MAX_REPOST_FAILURES) {
          await adRef.update({
            status: AdStatus.ACTIVE,
            pendingRepostSince: null,
            autoRepost: false,
            repostFailureCount: failureCount,
            repostDisabledReason: userFriendlyMessage,
            repostDisabledAt: new Date().toISOString(),
            nextRepostAt: null,
            repostDisabledErrorCode: errorCode,
          });

          // Write a notification the dashboard can surface (both persistent + live SSE)
          await this.notificationsService.emit(userId, {
            type: 'repost_disabled',
            adId,
            adTitle: adData.title || 'Anzeige',
            message: `Auto-Repost für "${adData.title || 'deine Anzeige'}" wurde nach ${MAX_REPOST_FAILURES} fehlgeschlagenen Versuchen deaktiviert. Bitte prüfe die Anzeige und aktiviere sie erneut.`,
          }).catch((err: any) => this.logger.warn(`Failed to emit notification for ${adId}: ${err.message}`));

          this.logger.warn(`${logCtx(userId, adId, runId)} Auto-Repost disabled after ${MAX_REPOST_FAILURES} failures [${errorCode}]`);
        } else {
          await adRef.update({
            status: AdStatus.ACTIVE,
            pendingRepostSince: null,
            repostFailureCount: failureCount,
          });
          this.logger.warn(`${logCtx(userId, adId, runId)} Repost failure ${failureCount}/${MAX_REPOST_FAILURES} [${errorCode}]`);
        }
      }
    }
  }

  @Cron('0 * * * *') // Runs every hour
  async trackRepostViews() {
    if (process.env.SCHEDULER_ENABLED === 'false') return; // kill-switch (see handleRepostCron)
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
                // Space out scrape calls to avoid hitting marketplace rate limits.
                await new Promise((r) => setTimeout(r, SCHEDULER_CONFIG.scrapeDelayMs));
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

  /**
   * Wettbewerb (competitor tracker) recheck cron. @nestjs/schedule only
   * supports one fixed expression per method — it can't natively run "this
   * specific search every N days from when it was created." So, mirroring
   * how handleRepostCron finds due ads via nextRepostAt <= now rather than
   * per-item cron jobs: this coarse 30-minute tick queries for anything
   * whose own nextCheckAt has passed, and performCheck() itself advances
   * that timestamp by the search's own checkIntervalDays afterwards. A
   * 30-minute granularity is more than precise enough for day-scale
   * intervals (daily/every-2-days/weekly).
   */
  @Cron(process.env.WETTBEWERB_SIMULATE === 'true' ? '*/1 * * * *' : '*/30 * * * *')
  async handleWettbewerbRecheckCron() {
    if (!FEATURE_FLAGS.enableWettbewerb) return; // flag-off = instant no-op, no Firestore/worker calls
    if (this.wettbewerbCronRunning) {
      this.logger.warn('Wettbewerb recheck run skipped — previous run still in progress');
      return;
    }
    this.wettbewerbCronRunning = true;

    const runId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 8);
    const ctx = `[wettbewerb run=${runId}]`;

    try {
      if (await this.wettbewerbService.isGloballyPaused()) {
        this.logger.log(`${ctx} Skipped — global scrape cooldown active (recent IP block)`);
        return;
      }

      const db = this.firebaseService.firestore;
      const nowIso = new Date().toISOString();
      const dueSnap = await db.collectionGroup('wettbewerbSearches')
        .where('status', '==', 'active')
        .where('nextCheckAt', '<=', nowIso)
        .get();

      if (dueSnap.empty) {
        this.logger.log(`${ctx} No due searches this run`);
        return;
      }

      this.logger.log(`${ctx} Processing ${dueSnap.size} due search(es)`);

      for (const doc of dueSnap.docs) {
        const userId = doc.ref.parent?.parent?.id;
        if (!userId) continue;

        // A block detected mid-run should stop the rest of this tick rather
        // than hammering an already-blocked shared IP for every remaining item.
        if (await this.wettbewerbService.isGloballyPaused()) {
          this.logger.warn(`${ctx} Global cooldown triggered mid-run — stopping remaining checks`);
          break;
        }

        try {
          await this.wettbewerbService.performCheck(userId, doc.id, doc.data(), runId);
        } catch (e: any) {
          // performCheck already handles scrape failures internally (writes
          // lastCheckError, advances nextCheckAt) — this only catches truly
          // unexpected errors (e.g. a Firestore write failure) so one bad
          // search can never abort the whole run.
          this.logger.error(`${ctx} user=${userId} search=${doc.id} unexpected error: ${e.message}`, e.stack);
        }
      }
    } catch (error: any) {
      this.logger.error(`${ctx} Cron iteration failed: ${error.message}`, error.stack);
    } finally {
      this.wettbewerbCronRunning = false;
    }
  }
}
