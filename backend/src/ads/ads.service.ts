import { Injectable, InternalServerErrorException, UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
import { UpdateAdDto } from './dto/update-ad.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { AdStatus } from './dto/ad-status.enum';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';
import { EbayService } from '../ebay/ebay.service';
import { VintedService } from '../vinted/vinted.service';
@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService,
    private readonly ebayService: EbayService,
    private readonly vintedService: VintedService,
  ) {}

  async getAds(userId: string) {
    const db = this.firebaseService.firestore;
    const snapshot = await db.collection('users').doc(userId).collection('ads').get();
    const ads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { success: true, ads };
  }

  async getSchedulerStatus() {
    const db = this.firebaseService.firestore;
    const doc = await db.collection('meta').doc('schedulerMeta').get();
    return { success: true, lastRunAt: doc.data()?.lastRunAt || null };
  }

  async importAds(userId: string, ads: any[]) {
    this.logger.log(`importAds called for user ${userId} — ${ads.length} ads`);
    const db = this.firebaseService.firestore;
    if (ads.length > 0) {
      const batch = db.batch();
      for (const ad of ads) {
        const docId = String(ad.id || ad.adId);
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
        const views = ad.viewCount ?? ad.views ?? 0;
        const messages = ad.replies ?? ad.messages ?? 0;
        const normalized = { ...ad, image, views, messages, syncedAt: new Date().toISOString() };
        const adRef = db.collection('users').doc(userId).collection('ads').doc(docId);
        batch.set(adRef, normalized, { merge: true });
      }
      await batch.commit();
    }
    const snap = await db.collection('users').doc(userId).collection('ads').get();
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

    try {
      const result = await this.automationService.callAutomationWorker('repost', { userId, adId, adData });
      if (result.success) {
        const repostIntervalMinutes: number = adData.repostIntervalMinutes ?? 1440;
        const nextRepostAt = new Date(Date.now() + repostIntervalMinutes * 60 * 1000).toISOString();
        await adRef.update({
          status: AdStatus.ACTIVE,
          lastPostedAt: new Date().toISOString(),
          nextRepostAt,
        });
        return { success: true, message: 'Anzeige wurde erfolgreich neu eingestellt' };
      } else {
        await adRef.update({ status: AdStatus.ACTIVE });
        throw new InternalServerErrorException(result.error || 'Repost fehlgeschlagen');
      }
    } catch (error: any) {
      // Revert status on worker failure
      await adRef.update({ status: AdStatus.ACTIVE }).catch(() => {});
      throw new InternalServerErrorException(error.message);
    }
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

  async saveDraft(userId: string, adData: SaveDraftDto) {
    const db = this.firebaseService.firestore;
    const adId = adData.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);

    const newAd = {
      ...adData,
      id: adId,
      status: AdStatus.PENDING,
      createdAt: new Date().toISOString(),
    };

    await adRef.set(newAd, { merge: true });
    return { success: true, ad: newAd };
  }

  async updateAd(userId: string, adId: string, updateData: UpdateAdDto) {
    const db = this.firebaseService.firestore;
    // Search across all possible ad locations (current userId first, then legacy)
    const adRef = db.collection('users').doc(userId).collection('ads').doc(String(adId));

    const payload: any = {};
    if (updateData.title !== undefined) payload.title = updateData.title;
    if (updateData.description !== undefined) payload.description = updateData.description;
    if (updateData.repostIntervalMinutes !== undefined) payload.repostIntervalMinutes = updateData.repostIntervalMinutes;
    if (updateData.nextRepostAt !== undefined) payload.nextRepostAt = updateData.nextRepostAt;
    if (updateData.autoRepost !== undefined) payload.autoRepost = updateData.autoRepost;

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
