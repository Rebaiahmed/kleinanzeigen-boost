import { Injectable, InternalServerErrorException, UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
import { UpdateAdDto } from './dto/update-ad.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { AdStatus } from './dto/ad-status.enum';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';
import { EbayService } from '../ebay/ebay.service';
import { VintedService } from '../vinted/vinted.service';
import { classifyRepostError } from '../common/repost-error.util';
import { SessionService } from '../auth/session.service';
import { applySmartVariation, computeNextSmartRepost } from '../config/smart-repost';
@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService,
    private readonly ebayService: EbayService,
    private readonly vintedService: VintedService,
    private readonly sessionService: SessionService,
  ) {}

  async getAds(userId: string) {
    const db = this.firebaseService.firestore;
    const snapshot = await db.collection('users').doc(userId).collection('ads').get();
    const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, ads };
  }

  async clearAllAds(userId: string) {
    const db = this.firebaseService.firestore;
    const adsCol = db.collection('users').doc(userId).collection('ads');
    const snapshot = await adsCol.get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    this.logger.log(`✓ Cleared ${snapshot.docs.length} ads for user ${userId}`);
    return { success: true, cleared: snapshot.docs.length };
  }

  async getSchedulerStatus() {
    const db = this.firebaseService.firestore;
    const doc = await db.collection('meta').doc('schedulerMeta').get();
    return { success: true, lastRunAt: doc.data()?.lastRunAt || null };
  }

  /**
   * Map a Kleinanzeigen ad's reported state to our listingState. Defensive —
   * KA's JSON field naming varies, so we check several shapes. listingState is
   * SEPARATE from `status` (which tracks our repost lifecycle), so reserved/
   * paused listings are recognisable without disturbing scheduler state.
   */
  private mapListingState(ad: any): 'active' | 'reserved' | 'paused' {
    const raw = String(ad.status ?? ad.adStatus ?? ad.state ?? ad.listingState ?? '').toLowerCase();
    const flags = Array.isArray(ad.flags) ? ad.flags.map((f: any) => String(f).toLowerCase()) : [];
    const has = (re: RegExp) => re.test(raw) || flags.some((f: string) => re.test(f));

    if (ad.reserved === true || ad.isReserved === true || has(/reserv/)) return 'reserved';
    if (ad.paused === true || ad.deactivated === true || has(/paus|inactive|deactiv|offline/)) return 'paused';
    return 'active';
  }

  async importAds(userId: string, ads: any[]) {
    this.logger.log(`importAds called for user ${userId} — ${ads.length} ads`);
    const db = this.firebaseService.firestore;
    const adsCol = db.collection('users').doc(userId).collection('ads');

    // Read existing ads first so we can (a) preserve in-flight repost status and
    // (b) reconcile listings that disappeared from KA (deleted/expired).
    const existingSnap = await adsCol.get();
    const existingIds = new Set(existingSnap.docs.map(d => d.id));
    const incomingIds = new Set<string>();

    // One-time visibility into KA's state fields so the mapping can be verified
    // against real payloads (KA's JSON naming isn't documented).
    if (ads.length > 0) {
      const s = ads[0];
      this.logger.log(`importAds state sample → status=${s.status} adStatus=${s.adStatus} state=${s.state} reserved=${s.reserved} flags=${JSON.stringify(s.flags)} → mapped=${this.mapListingState(s)}`);
      this.logger.log(`importAds photo fields → pictureUrls=${Array.isArray(s.pictureUrls) ? s.pictureUrls.length : 'N/A'}, pictures=${Array.isArray(s.pictures) ? s.pictures.length : 'N/A'}, imageCount=${s.imageCount}`);
      if (s.pictureUrls) this.logger.log(`  Sample pictureUrls[0]: ${typeof s.pictureUrls[0] === 'object' ? JSON.stringify(s.pictureUrls[0]).substring(0, 100) : s.pictureUrls[0]?.substring(0, 100)}`);
    }

    if (ads.length > 0) {
      const batch = db.batch();
      for (const ad of ads) {
        const docId = String(ad.id || ad.adId);
        incomingIds.add(docId);
        // Normalize fields from Kleinanzeigen API to frontend-expected names
        // adImage can be: a string URL, an object {src}, or a relative path
        const rawImage = ad.adImage || ad.image || ad.thumbnailUrl || ad.pictureUrls?.[0];
        let image: string | null = null;
        if (typeof rawImage === 'string') {
          image = rawImage.startsWith('http') ? rawImage : `https://www.kleinanzeigen.de${rawImage}`;
        } else if (rawImage && typeof rawImage === 'object') {
          const src = rawImage.src || rawImage.url || rawImage.href || Object.values(rawImage)[0];
          image = typeof src === 'string' ? (src.startsWith('http') ? src : `https://www.kleinanzeigen.de${src}`) : null;
        }

        // Extract all photo URLs (from pictureUrls or pictures array)
        let pictures: string[] = [];
        const rawPictures = ad.pictureUrls || ad.pictures || ad.images || [];
        if (Array.isArray(rawPictures)) {
          pictures = rawPictures
            .map((pic: any) => {
              if (typeof pic === 'string') {
                return pic.startsWith('http') ? pic : `https://www.kleinanzeigen.de${pic}`;
              } else if (pic && typeof pic === 'object') {
                const url = pic.src || pic.url || pic.href || Object.values(pic)[0];
                return typeof url === 'string' ? (url.startsWith('http') ? url : `https://www.kleinanzeigen.de${url}`) : null;
              }
              return null;
            })
            .filter((url: any) => url !== null);
        }

        const views = ad.viewCount ?? ad.views ?? 0;
        const messages = ad.replies ?? ad.messages ?? 0;
        // Kleinanzeigen calls favorites "watchCount". It was synced (via ...ad) but
        // never surfaced as `favorites`, so the heart count rendered blank in the UI
        // and couldn't be sorted on. Map it explicitly.
        const favorites = ad.watchCount ?? ad.favorites ?? 0;
        const listingState = this.mapListingState(ad);
        // Re-checked on every sync: a lifted reservation flips listingState back
        // to 'active', clearing the badge and re-enabling auto-repost.
        const normalized: any = { ...ad, image, pictures, views, messages, favorites, listingState, syncedAt: new Date().toISOString() };
        // firstSyncedAt is set ONCE, on first import (merge preserves it after),
        // so newly-appeared ads can be sorted to the top ("Neueste zuerst").
        if (!existingIds.has(docId)) normalized.firstSyncedAt = new Date().toISOString();
        batch.set(adsCol.doc(docId), normalized, { merge: true });
      }
      await batch.commit();
    }

    // Reconcile: KA-synced ads that are no longer returned were deleted/expired
    // on Kleinanzeigen. Flag them (don't delete) so the dashboard can surface or
    // filter them. Skip in-app drafts (never came from KA).
    const gone = existingSnap.docs.filter(d => {
      const data: any = d.data();
      const isDraft = String(d.id).startsWith('draft_') || data.status === 'pending';
      return data.syncedAt && !isDraft && !incomingIds.has(d.id) && data.listingState !== 'deleted';
    });
    if (gone.length > 0) {
      const delBatch = db.batch();
      gone.forEach(d => delBatch.update(d.ref, { listingState: 'deleted', deletedDetectedAt: new Date().toISOString() }));
      await delBatch.commit();
      this.logger.log(`importAds: flagged ${gone.length} ad(s) as deleted/expired (gone from KA)`);
    }

    // Housekeeping: hard-delete ads that have been soft-deleted for >30 days, so the
    // DB doesn't grow forever. Runs opportunistically on sync (no extra cron/index).
    const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
    const purgeCutoff = Date.now() - PURGE_AFTER_MS;
    const stale = existingSnap.docs.filter(d => {
      const data: any = d.data();
      const detectedAt = Date.parse(data.deletedDetectedAt || '');
      return data.listingState === 'deleted' && detectedAt && detectedAt <= purgeCutoff;
    });
    if (stale.length > 0) {
      const purgeBatch = db.batch();
      stale.forEach(d => purgeBatch.delete(d.ref));
      await purgeBatch.commit();
      this.logger.log(`importAds: purged ${stale.length} ad(s) soft-deleted >30 days ago`);
    }

    // Migrate the removed 5min/10min intervals to Smart Repost (one-time, idempotent).
    const toSmart = existingSnap.docs.filter(d => {
      const data: any = d.data();
      return !data.repostMode && (data.repostIntervalMinutes === 5 || data.repostIntervalMinutes === 10);
    });
    if (toSmart.length > 0) {
      const migBatch = db.batch();
      const nextRepostAt = computeNextSmartRepost(Date.now());
      toSmart.forEach(d => migBatch.update(d.ref, {
        repostMode: 'smart',
        repostIntervalMinutes: null,
        ...(d.data().autoRepost ? { nextRepostAt } : {}),
      }));
      await migBatch.commit();
      this.logger.log(`importAds: migrated ${toSmart.length} ad(s) from 5/10min to Smart Repost`);
    }

    const snap = await adsCol.get();
    const allAds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, ads: allAds };
  }

  async syncAds(userId: string) {
    this.logger.log(`syncAds called for user: ${userId}`);
    const db = this.firebaseService.firestore;
    
    // Ensure session document exists — auto-create if missing (e.g. after server restart
    // with in-memory DB). The JWT being valid is sufficient proof of identity.
    const sessionDoc = await db.collection('sessions').doc(userId).get();
    if (!sessionDoc.exists || sessionDoc.data()?.status !== 'active') {
      await db.collection('sessions').doc(userId).set({
        status: 'active',
        lastLogin: new Date().toISOString(),
      }, { merge: true });
    }

    // Sync is now extension-initiated via /ads/import — this endpoint
    // just returns the current cached ads from the DB.
    const snap = await db.collection('users').doc(userId).collection('ads').get();
    const ads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { success: true, ads };
  }

  async addAd(userId: string, adData: any) {
    const result = await this.automationService.callAutomationWorker('ads/create', { userId, adData });
    if (!result.success) {
      throw new InternalServerErrorException(result.error || 'Ad creation failed');
    }
    // Persist the new ad to Firestore
    const db = this.firebaseService.firestore;
    const adRef = db
      .collection('users')
      .doc(userId)
      .collection('ads')
      .doc(result.adId || adData.id || Date.now().toString());
    await adRef.set(
      { ...adData, status: AdStatus.ACTIVE, createdAt: new Date().toISOString() },
      { merge: true },
    );
    return { success: true, ad: result.ad };
  }

  async repostAd(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);

    let adData: any;
    try {
      await db.runTransaction(async (t) => {
        const doc = await t.get(adRef);
        if (!doc.exists) {
          throw new Error('Ad not found');
        }
        adData = doc.data();
        // Atomic integrity requirement: active -> pending_repost
        t.update(adRef, { status: AdStatus.PENDING_REPOST });
      });
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }

    const startTime = Date.now();
    try {
      // The repost worker uses a fresh browser context — it must be given the
      // user's session cookies (same as scrape-views), otherwise it lands on the
      // login page and throws a false SESSION_EXPIRED.
      const cookies = await this.sessionService.getDecryptedCookies(userId);
      this.logger.warn(`[repost-debug] userId=${userId} → ${cookies.length} session cookie(s) found${cookies.length ? ` (names: ${cookies.slice(0, 8).map((c: any) => c.name).join(',')})` : ' — NONE: cookies are stored under a different id or missing → re-run Verbinden'}`);
      // Smart mode: apply one micro-variation + schedule the next repost before a
      // peak (≥7 days out). Manual mode: post as-is, reschedule by interval.
      const isSmart = adData.repostMode === 'smart';
      const repostCount = Number(adData.trackedRepostsCount) || 0;
      const varied = isSmart ? applySmartVariation(adData, adData.smartVariation, repostCount) : { adData, applied: 'none' as const };
      const result = await this.automationService.callAutomationWorker('repost', { userId, adId, adData: varied.adData, cookies });
      if (result.success) {
        const nextRepostAt = isSmart
          ? computeNextSmartRepost(Date.now())
          : new Date(Date.now() + (adData.repostIntervalMinutes ?? 1440) * 60 * 1000).toISOString();
        await adRef.update({
          status: AdStatus.ACTIVE,
          lastPostedAt: new Date().toISOString(),
          nextRepostAt,
          trackedRepostsCount: repostCount + 1,
          ...(result.newAdId ? { lastRepostNewAdId: result.newAdId } : {}),
          ...(result.newAdUrl ? { lastRepostNewAdUrl: result.newAdUrl } : {}),
        });
        await adRef.collection('repostLogs').add({
          status: 'success', executedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime, triggeredBy: 'manual', runId: null,
          newAdId: result.newAdId || null, newAdUrl: result.newAdUrl || null,
        }).catch(() => {});
        return { success: true, message: 'Anzeige wurde erfolgreich neu eingestellt', newAdId: result.newAdId || null, newAdUrl: result.newAdUrl || null };
      } else {
        await adRef.update({ status: AdStatus.ACTIVE });
        throw new InternalServerErrorException(result.error || 'Repost fehlgeschlagen');
      }
    } catch (error: any) {
      const errorCode = classifyRepostError(error.message);
      this.logger.error(`[manual repost user=${userId} ad=${adId}] ✗ failed [${errorCode}]: ${error.message}`);
      // Revert status on worker failure
      await adRef.update({ status: AdStatus.ACTIVE }).catch(() => {});
      // Record the failure for traceability (same shape as the scheduler logs).
      await adRef.collection('repostLogs').add({
        status: 'failed', errorCode, error: (error.message || 'unknown').slice(0, 500),
        executedAt: new Date().toISOString(), durationMs: Date.now() - startTime,
        triggeredBy: 'manual', runId: null,
      }).catch(() => {});
      throw new InternalServerErrorException(error.message);
    }
  }

  /** Diagnostic: what the scheduler sees for this user's auto-repost ads. */
  async getScheduleDebug(userId: string) {
    const db = this.firebaseService.firestore;
    const snap = await db.collection('users').doc(userId).collection('ads').get();
    const now = new Date().toISOString();
    const ads = snap.docs
      .map((d) => {
        const a: any = d.data();
        return {
          id: d.id,
          title: String(a.title || '').replace(/<[^>]+>/g, '').slice(0, 40),
          autoRepost: a.autoRepost ?? null,
          status: a.status ?? null,
          listingState: a.listingState ?? null,
          nextRepostAt: a.nextRepostAt ?? null,
          dueNow: a.autoRepost === true && a.status === AdStatus.ACTIVE && !!a.nextRepostAt && a.nextRepostAt <= now,
        };
      })
      .filter((a) => a.autoRepost);
    return { success: true, now, count: ads.length, ads };
  }

  /** Unread notifications (newest first) for the dashboard poller. */
  async getUnreadNotifications(userId: string) {
    const db = this.firebaseService.firestore;
    const snap = await db.collection('users').doc(userId).collection('notifications')
      .where('read', '==', false).get();
    const items = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { success: true, notifications: items };
  }

  /** Mark the given notification ids as read. */
  async markNotificationsRead(userId: string, ids: string[]) {
    if (!ids?.length) return { success: true, updated: 0 };
    const db = this.firebaseService.firestore;
    const batch = db.batch();
    ids.forEach(id => batch.update(
      db.collection('users').doc(userId).collection('notifications').doc(id),
      { read: true },
    ));
    await batch.commit().catch(() => {});
    return { success: true, updated: ids.length };
  }

  /**
   * DISABLED — the server-side repost/snapshot approach is parked (we moved to
   * client-side). Returns immediately and never calls the automation worker, so
   * a stray client loop can't spawn browser tabs. Re-enable only intentionally.
   */
  async snapshotAd(_userId: string, _adId: string) {
    return { success: false, disabled: true, message: 'repost-snapshot is disabled (server-side repost parked).' };
  }

  async toggleReserve(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(adRef);
      if (!doc.exists) throw new Error('Ad not found');
      
      const currentStatus = doc.data()?.status;
      const newStatus = currentStatus === AdStatus.RESERVED ? AdStatus.ACTIVE : AdStatus.RESERVED;
      
      // Atomic update
      t.update(adRef, { status: newStatus });
    });

    // Stub: Trigger automation worker to sync state with marketplace
    return { success: true, message: 'Reserve status toggled' };
  }

  async toggleAutoRepost(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(adRef);
      if (!doc.exists) throw new Error('Ad not found');
      
      const current = doc.data()?.autoRepost || false;
      
      // Atomic update
      t.update(adRef, { autoRepost: !current });
    });

    return { success: true, message: 'Auto-repost status toggled' };
  }

  async activateAd(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
    // Optimistically update local state first
    await adRef.update({ status: AdStatus.ACTIVE });
    try {
      await this.automationService.callAutomationWorker('ads/activate', { userId, adId });
    } catch (err: any) {
      // Revert if worker fails
      await adRef.update({ status: AdStatus.PAUSED }).catch(() => {});
      throw new InternalServerErrorException(err.message || 'Anzeige konnte nicht aktiviert werden');
    }
    return { success: true, message: 'Anzeige wurde aktiviert' };
  }

  async pauseAd(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
    // Optimistically update local state first
    await adRef.update({ status: AdStatus.PAUSED });
    try {
      await this.automationService.callAutomationWorker('ads/pause', { userId, adId });
    } catch (err: any) {
      // Revert if worker fails
      await adRef.update({ status: AdStatus.ACTIVE }).catch(() => {});
      throw new InternalServerErrorException(err.message || 'Anzeige konnte nicht pausiert werden');
    }
    return { success: true, message: 'Anzeige wurde pausiert' };
  }

  async deleteAd(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
    // Call worker first — if it fails, we do NOT delete from Firestore
    try {
      await this.automationService.callAutomationWorker('ads/delete', { userId, adId });
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Anzeige konnte nicht auf dem Marktplatz gelöscht werden');
    }
    await adRef.delete();
    return { success: true, message: 'Anzeige wurde gelöscht' };
  }

  async saveDraft(userId: string, adData: SaveDraftDto, files: any[] = []) {
    const db = this.firebaseService.firestore;
    const adId = adData.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);

    const images = await this.uploadDraftImages(userId, adId, files);

    let keyFeatures: string[] | undefined;
    try { keyFeatures = adData.keyFeatures ? JSON.parse(adData.keyFeatures) : undefined; } catch { keyFeatures = undefined; }
    let vinted: any;
    try { vinted = adData.vinted ? JSON.parse(adData.vinted) : undefined; } catch { vinted = undefined; }

    const { keyFeatures: _kf, vinted: _v, ...rest } = adData;

    const newAd: Record<string, any> = {
      ...rest,
      id: adId,
      status: AdStatus.PENDING,
      createdAt: new Date().toISOString(),
      date: new Date().toLocaleDateString('de-DE'),
      views: 0,
      favorites: 0,
      messages: 0,
    };
    if (keyFeatures) newAd.keyFeatures = keyFeatures;
    if (vinted) newAd.vinted = vinted;
    // Only overwrite images if new ones were uploaded — re-saving an existing draft
    // without touching photos shouldn't wipe out its previously stored images.
    if (images.length > 0) {
      newAd.images = images;
      newAd.image = images[0];
    }

    await adRef.set(newAd, { merge: true });
    return { success: true, ad: newAd };
  }

  /** Uploads draft photo buffers to Firebase Storage under drafts/<userId>/<adId>/
   *  and returns their public URLs. Returns [] (skips persistence) if Storage
   *  isn't configured — callers must not treat that as a hard failure since a
   *  draft's text fields should still save even without image support. */
  private async uploadDraftImages(userId: string, adId: string, files: any[]): Promise<string[]> {
    if (!files || files.length === 0) return [];
    const bucket = this.firebaseService.storageBucket;
    if (!bucket) return [];

    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = (file.mimetype || 'image/jpeg').split('/')[1] || 'jpg';
      const destination = `drafts/${userId}/${adId}/${i}.${ext}`;
      const blob = bucket.file(destination);
      await blob.save(file.buffer, { contentType: file.mimetype });
      try {
        // Works on buckets with fine-grained (legacy ACL) access.
        await blob.makePublic();
        urls.push(`https://storage.googleapis.com/${bucket.name}/${destination}`);
      } catch {
        // Uniform bucket-level access (the modern GCS default) rejects
        // per-object ACLs — fall back to a long-lived signed URL instead.
        const [signedUrl] = await blob.getSignedUrl({ action: 'read', expires: '01-01-2100' });
        urls.push(signedUrl);
      }
    }
    return urls;
  }

  async deleteDraft(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
    const doc = await adRef.get();
    if (!doc.exists) {
      return { success: true }; // already gone
    }
    const data = doc.data() as any;
    if (data?.status !== AdStatus.PENDING) {
      throw new InternalServerErrorException('Nur Entwürfe können auf diesem Weg gelöscht werden.');
    }

    await adRef.delete();

    const bucket = this.firebaseService.storageBucket;
    if (bucket) {
      try {
        await bucket.deleteFiles({ prefix: `drafts/${userId}/${adId}/` });
      } catch (err: any) {
        this.logger.warn(`Failed to delete draft images for ${adId}: ${err.message}`);
      }
    }

    return { success: true };
  }

  async updateAd(userId: string, adId: string, updateData: UpdateAdDto) {
    const db = this.firebaseService.firestore;
    // Search across all possible ad locations (current userId first, then legacy)
    const adRef = db.collection('users').doc(userId).collection('ads').doc(String(adId));

    const payload: any = {};
    if (updateData.title !== undefined) payload.title = updateData.title;
    if (updateData.description !== undefined) payload.description = updateData.description;
    if (updateData.status !== undefined) payload.status = updateData.status;
    if (updateData.repostIntervalMinutes !== undefined) payload.repostIntervalMinutes = updateData.repostIntervalMinutes;
    if (updateData.nextRepostAt !== undefined) payload.nextRepostAt = updateData.nextRepostAt;
    if (updateData.autoRepost !== undefined) payload.autoRepost = updateData.autoRepost;
    if (updateData.trackedRepostsCount !== undefined) payload.trackedRepostsCount = updateData.trackedRepostsCount;
    // Smart Repost config
    if (updateData.repostMode !== undefined) payload.repostMode = updateData.repostMode;
    if (updateData.smartVariation !== undefined) payload.smartVariation = updateData.smartVariation;
    // When switching to smart mode, schedule the next repost at a peak window.
    if (updateData.repostMode === 'smart' && updateData.autoRepost !== false) {
      payload.nextRepostAt = computeNextSmartRepost(Date.now());
    }

    // Auto-set status to ACTIVE when enabling auto-repost (if not explicitly set and not mid-repost).
    // Frontend should explicitly set status='active' when scheduling to guarantee scheduler finds it.
    if (updateData.autoRepost === true && updateData.status === undefined) {
      const cur = (await adRef.get()).data() as any;
      const st = cur?.status;
      if (st !== AdStatus.PENDING && st !== AdStatus.PENDING_REPOST) {
        payload.status = AdStatus.ACTIVE;
      }
    }

    if (Object.keys(payload).length > 0) {
      // Use merge:true so it creates the doc if it doesn't exist (handles userId mismatch)
      await adRef.set(payload, { merge: true });
    }

    return { success: true, message: 'Anzeige erfolgreich aktualisiert' };
  }

  async crossPostEbay(userId: string, adId: string) {
    return this.ebayService.crossPostAd(userId, adId);
  }

  async crossPostVinted(userId: string, adId: string) {
    return this.vintedService.crossPostAd(userId, adId);
  }
}
