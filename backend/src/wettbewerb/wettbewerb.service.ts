import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';
import { AdsService } from '../ads/ads.service';
import { AdStatus } from '../ads/dto/ad-status.enum';
import { PlzValidationService } from './plz-validation.service';
import { CreditsService } from '../credits/credits.service';
import { CreateSavedSearchDto } from './dto/wettbewerb.dto';
import {
  RADIUS_OPTIONS_KM,
  CHECK_INTERVAL_OPTIONS_DAYS,
  FREE_SAVED_SEARCH_LIMIT,
  ADDITIONAL_SEARCH_CREDIT_COST,
} from '../config/wettbewerb.constants';

interface CompetitorRow {
  rank: number;
  title: string;
  priceEUR: number | null;
  adId: string;
}

interface CompetitorRowWithOwn extends CompetitorRow {
  isOwn: boolean;
}

// After this many consecutive check failures, a saved search flips to
// status:'error' (shown on the card with a retry affordance) instead of
// silently staying 'active' forever with a stale snapshot.
const MAX_CONSECUTIVE_FAILURES = 3;

type ScrapeErrorCode = 'IP_BLOCKED' | 'SCRAPE_TIMEOUT' | 'SCRAPE_MALFORMED_PAGE' | 'CAPTCHA_DETECTED' | 'UNKNOWN';

function classifyScrapeError(message: string): ScrapeErrorCode {
  if (/IP_BLOCKED/.test(message)) return 'IP_BLOCKED';
  if (/SCRAPE_TIMEOUT/.test(message)) return 'SCRAPE_TIMEOUT';
  if (/SCRAPE_MALFORMED_PAGE/.test(message)) return 'SCRAPE_MALFORMED_PAGE';
  if (/CAPTCHA_DETECTED/.test(message)) return 'CAPTCHA_DETECTED';
  return 'UNKNOWN';
}

const GERMAN_ERROR_MESSAGES: Record<ScrapeErrorCode, string> = {
  IP_BLOCKED: 'Vorübergehend blockiert, wird automatisch erneut versucht.',
  SCRAPE_TIMEOUT: 'Zeitüberschreitung beim Abrufen der Ergebnisse.',
  SCRAPE_MALFORMED_PAGE: 'Konnte die Ergebnisseite nicht auswerten.',
  CAPTCHA_DETECTED: 'Automatische Prüfung vorübergehend nicht möglich.',
  UNKNOWN: 'Prüfung vorübergehend fehlgeschlagen.',
};

@Injectable()
export class WettbewerbService {
  private readonly logger = new Logger(WettbewerbService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService,
    private readonly adsService: AdsService,
    private readonly plzValidationService: PlzValidationService,
    private readonly creditsService: CreditsService,
  ) {}

  private searchesCol(userId: string) {
    return this.firebaseService.firestore.collection('users').doc(userId).collection('wettbewerbSearches');
  }

  /** Plain Firestore bookkeeping — no credits system involved, same as
   *  before the credits-stub swap. */
  private async canCreateFreeSearch(userId: string): Promise<boolean> {
    const doc = await this.firebaseService.firestore.collection('users').doc(userId).get();
    return doc.data()?.wettbewerbFreeSearchUsed !== true;
  }

  private async markFreeSearchUsed(userId: string): Promise<void> {
    await this.firebaseService.firestore
      .collection('users')
      .doc(userId)
      .set({ wettbewerbFreeSearchUsed: true }, { merge: true });
  }

  async listSavedSearches(userId: string) {
    const snap = await this.searchesCol(userId).orderBy('createdAt', 'asc').get();
    return { searches: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) };
  }

  async createSavedSearch(userId: string, dto: CreateSavedSearchDto) {
    // Defense in depth — re-validate even though the DTO decorators already
    // enforce this, since services can be called from tests/other code paths
    // that bypass DTO validation.
    const keyword = dto.keyword.trim();
    if (!keyword) throw new BadRequestException('Bitte einen Suchbegriff eingeben');

    const plzResult = this.plzValidationService.validate(dto.plz);
    if (!plzResult.valid) {
      throw new BadRequestException('Bitte eine gültige 5-stellige PLZ eingeben (z. B. 48143)');
    }
    if (!(RADIUS_OPTIONS_KM as readonly number[]).includes(dto.radiusKm)) {
      throw new BadRequestException('Ungültiger Radius');
    }
    if (!(CHECK_INTERVAL_OPTIONS_DAYS as readonly number[]).includes(dto.checkIntervalDays)) {
      throw new BadRequestException('Ungültiges Prüfintervall');
    }

    const searchRef = this.searchesCol(userId).doc();
    const isFree = await this.canCreateFreeSearch(userId);

    // Reserve BEFORE writing the doc — a thrown 402 (insufficient credits)
    // here never orphans a saved-search doc. reserve() deducts immediately;
    // confirm(true) below just releases the reservation record once the doc
    // write succeeds, confirm(false) refunds if it doesn't.
    const creditActionId = isFree ? null : randomUUID();
    if (!isFree && creditActionId) {
      await this.creditsService.reserve(userId, 'competitor_tracking', creditActionId);
    }

    const now = new Date().toISOString();
    const doc = {
      keyword,
      plz: dto.plz,
      radiusKm: dto.radiusKm,
      checkIntervalDays: dto.checkIntervalDays,
      createdAt: now,
      updatedAt: now,
      isFree,
      status: 'active' as const,
      // now, not now+interval — the first check runs on the very next cron
      // tick instead of waiting a full interval.
      nextCheckAt: now,
      lastCheckedAt: null,
      lastCheckError: null,
      failureCount: 0,
      latestSnapshot: null,
    };
    try {
      await searchRef.set(doc);
    } catch (err) {
      if (creditActionId) await this.creditsService.confirm(creditActionId, false).catch(() => {});
      throw err;
    }
    if (creditActionId) await this.creditsService.confirm(creditActionId, true).catch(() => {});

    if (isFree) {
      await this.markFreeSearchUsed(userId);
    }

    return { id: searchRef.id, ...doc };
  }

  async deleteSavedSearch(userId: string, searchId: string) {
    await this.searchesCol(userId).doc(searchId).delete();
    return { success: true };
  }

  async markGuideSeen(userId: string) {
    await this.firebaseService.firestore
      .collection('users')
      .doc(userId)
      .set({ hasSeenWettbewerb: true }, { merge: true });
    return { success: true };
  }

  async getUsage(userId: string) {
    const userDoc = await this.firebaseService.firestore.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    const searchesSnap = await this.searchesCol(userId).get();
    return {
      freeSearchUsed: userData.wettbewerbFreeSearchUsed === true,
      savedSearchCount: searchesSnap.size,
      freeLimit: FREE_SAVED_SEARCH_LIMIT,
      additionalCost: ADDITIONAL_SEARCH_CREDIT_COST,
      hasSeenWettbewerb: userData.hasSeenWettbewerb === true,
    };
  }

  async applySuggestedPrice(userId: string, searchId: string, adId: string) {
    const searchDoc = await this.searchesCol(userId).doc(searchId).get();
    const snapshot: any = searchDoc.data()?.latestSnapshot;
    if (!snapshot || snapshot.suggestedPriceLow == null || snapshot.suggestedPriceHigh == null) {
      throw new BadRequestException('Kein Preisvorschlag verfügbar.');
    }
    const midpoint = (snapshot.suggestedPriceLow + snapshot.suggestedPriceHigh) / 2;
    const appliedPrice = Math.round(midpoint / 5) * 5;

    const adRef = this.firebaseService.firestore.collection('users').doc(userId).collection('ads').doc(adId);
    const adDoc = await adRef.get();
    if (!adDoc.exists) throw new NotFoundException('Anzeige nicht gefunden.');

    await adRef.set({ price: `${appliedPrice} €` }, { merge: true });
    return { success: true, appliedPrice };
  }

  async triggerRepostForSearch(userId: string, adId: string) {
    return this.adsService.repostAd(userId, adId);
  }

  /**
   * Fetches the user's currently-active ad IDs (Kleinanzeigen ad IDs are
   * also our Firestore ad-doc IDs) so scraped competitor rows can be
   * matched against "is this the user's own ad."
   */
  private async getOwnActiveAdIds(userId: string): Promise<Set<string>> {
    const snap = await this.firebaseService.firestore
      .collection('users')
      .doc(userId)
      .collection('ads')
      .where('status', '==', AdStatus.ACTIVE)
      .get();
    return new Set(snap.docs.map((d: any) => d.id));
  }

  private buildMatchedRows(results: CompetitorRow[], ownAdIds: Set<string>): CompetitorRowWithOwn[] {
    return results.map((r) => ({ ...r, isOwn: ownAdIds.has(r.adId) }));
  }

  /**
   * Never assumes the user's ad is present — if none of the scraped rows
   * match one of their active ad IDs, userAdRank/userAdId stay null (a
   * legitimate "not in these results" case, not an error). topCompetitors
   * is always the top-5-by-site-order rows; if the user's ad ranks outside
   * the top 5 it is NOT injected in — callers surface the real rank
   * separately instead of fabricating a top-5 position.
   */
  private matchOwnAds(rows: CompetitorRowWithOwn[]) {
    const ownMatch = rows.find((r) => r.isOwn);
    const topCompetitors = rows.slice(0, 5).map((r) => ({
      rank: r.rank,
      title: r.title,
      priceEUR: r.priceEUR,
      adId: r.adId,
      isOwn: r.isOwn,
    }));
    return {
      userAdRank: ownMatch ? ownMatch.rank : null,
      userAdId: ownMatch ? ownMatch.adId : null,
      topCompetitors,
    };
  }

  /**
   * Needs >=2 non-null competitor prices (excluding the user's own row) to
   * compute anything — a single price isn't a "range". Suggested price is a
   * plain heuristic (avg of the two lowest competitor prices, banded down
   * slightly, rounded to nearest 5€), not ML — documented here so nobody
   * over-engineers it later.
   */
  private computePriceInsights(rows: CompetitorRowWithOwn[]) {
    const competitorPrices = rows
      .filter((r) => !r.isOwn && r.priceEUR != null)
      .map((r) => r.priceEUR as number)
      .sort((a, b) => a - b);

    if (competitorPrices.length < 2) {
      return { priceRangeLow: null, priceRangeHigh: null, suggestedPriceLow: null, suggestedPriceHigh: null };
    }

    const round5 = (n: number) => Math.round(n / 5) * 5;
    const priceRangeLow = competitorPrices[0];
    const priceRangeHigh = competitorPrices[competitorPrices.length - 1];
    const min2Avg = (competitorPrices[0] + competitorPrices[1]) / 2;
    const suggestedPriceHigh = round5(min2Avg);
    const suggestedPriceLow = Math.min(round5(min2Avg * 0.98), suggestedPriceHigh);

    return { priceRangeLow, priceRangeHigh, suggestedPriceLow, suggestedPriceHigh };
  }

  /**
   * Shared by the cron and a manual "recheck now" trigger. Always advances
   * nextCheckAt (success or failure) so a single transient failure can
   * never turn into a retry-loop.
   */
  async performCheck(userId: string, searchId: string, searchData: any, runId: string): Promise<void> {
    const searchRef = this.searchesCol(userId).doc(searchId);
    const nowIso = new Date().toISOString();
    const nextCheckAt = new Date(
      Date.now() + (searchData.checkIntervalDays || 2) * 24 * 60 * 60 * 1000,
    ).toISOString();

    let scrapeResult: { results?: CompetitorRow[]; totalResultsFound?: number };
    try {
      scrapeResult = await this.automationService.callAutomationWorker('scrape-search', {
        keyword: searchData.keyword,
        plz: searchData.plz,
        radiusKm: searchData.radiusKm,
      });
    } catch (error: any) {
      await this.handleCheckFailure(userId, searchRef, searchData, error.message || 'UNKNOWN', nextCheckAt, runId);
      return;
    }

    const results = scrapeResult.results || [];
    const totalResultsFound = scrapeResult.totalResultsFound ?? results.length;

    const ownAdIds = await this.getOwnActiveAdIds(userId);
    const matchedRows = this.buildMatchedRows(results, ownAdIds);
    const { userAdRank, userAdId, topCompetitors } = this.matchOwnAds(matchedRows);
    const priceInsights = this.computePriceInsights(matchedRows);

    const latestSnapshot = {
      checkedAt: nowIso,
      totalResultsFound,
      userAdRank,
      userAdId,
      ...priceInsights,
      topCompetitors,
    };

    await searchRef.update({
      status: 'active',
      lastCheckedAt: nowIso,
      lastCheckError: null,
      failureCount: 0,
      nextCheckAt,
      latestSnapshot,
      updatedAt: nowIso,
    });

    await searchRef
      .collection('snapshots')
      .add({ ...latestSnapshot, runId, rawResultCount: results.length })
      .catch((e: any) => this.logger.warn(`[wettbewerb run=${runId}] Failed to write snapshot log: ${e.message}`));
  }

  private async handleCheckFailure(
    userId: string,
    searchRef: any,
    searchData: any,
    errorMessage: string,
    nextCheckAt: string,
    runId: string,
  ): Promise<void> {
    const classified = classifyScrapeError(errorMessage);
    this.logger.warn(`[wettbewerb run=${runId} user=${userId}] Check failed [${classified}]: ${errorMessage}`);

    if (classified === 'IP_BLOCKED') {
      // Shared cooldown, not per-user — the block is on the worker's shared
      // IP, since search-scraping is anonymous/public, not per-user session.
      await this.firebaseService.firestore
        .collection('meta')
        .doc('wettbewerbMeta')
        .set({ pausedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() }, { merge: true })
        .catch(() => {});
    }

    // CAPTCHA gets a one-time doubled interval before retrying this specific
    // search; other transient failures just use the normal next interval.
    const effectiveNextCheckAt =
      classified === 'CAPTCHA_DETECTED'
        ? new Date(Date.now() + 2 * (new Date(nextCheckAt).getTime() - Date.now())).toISOString()
        : nextCheckAt;

    const failureCount = (searchData.failureCount || 0) + 1;
    const status = failureCount >= MAX_CONSECUTIVE_FAILURES ? 'error' : 'active';

    await searchRef.update({
      status,
      lastCheckError: GERMAN_ERROR_MESSAGES[classified],
      failureCount,
      nextCheckAt: effectiveNextCheckAt,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Checks whether the shared anonymous-scrape IP cooldown is active. */
  async isGloballyPaused(): Promise<boolean> {
    const doc = await this.firebaseService.firestore.collection('meta').doc('wettbewerbMeta').get();
    const pausedUntil = doc.data()?.pausedUntil;
    return !!pausedUntil && new Date(pausedUntil).getTime() > Date.now();
  }
}
