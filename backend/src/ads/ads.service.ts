import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';
import { EbayService } from '../ebay/ebay.service';
import { VintedService } from '../vinted/vinted.service';

@Injectable()
export class AdsService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService,
    private readonly ebayService: EbayService,
    private readonly vintedService: VintedService
  ) {}

  async getAds(userId: string) {
    const db = this.firebaseService.firestore;
    const snapshot = await db.collection('users').doc(userId).collection('ads').get();
    const ads = snapshot.docs.map(doc => doc.data());
    return { success: true, ads };
  }

  async syncAds(userId: string) {
    const db = this.firebaseService.firestore;
    
    // 1. Fetch user cookies
    const sessionDoc = await db.collection('sessions').doc(userId).get();
    if (!sessionDoc.exists || sessionDoc.data()?.status !== 'active') {
      throw new UnauthorizedException('No active session found. Please log in again.');
    }
    
    const cookies = sessionDoc.data()?.marketplaceCookies;
    if (!cookies || !cookies.length) {
      throw new UnauthorizedException('No marketplace cookies found.');
    }

    // 2. Call Worker to scrape ads
    const workerResponse = await this.automationService.callAutomationWorker('sync', { cookies });
    
    if (!workerResponse.success) {
      if (workerResponse.error === 'Session expired') {
        await db.collection('sessions').doc(userId).update({ status: 'expired' });
        throw new UnauthorizedException('Kleinanzeigen session expired. Please log in again.');
      }
      throw new InternalServerErrorException(workerResponse.error || 'Failed to sync ads');
    }

    const ads = workerResponse.ads || [];

    // 3. Upsert ads to Firestore
    const batch = db.batch();
    for (const ad of ads) {
      const adRef = db.collection('users').doc(userId).collection('ads').doc(ad.id);
      batch.set(adRef, ad, { merge: true });
    }
    
    await batch.commit();

    return { success: true, message: 'Sync complete', ads };
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
      { ...adData, status: 'active', createdAt: new Date().toISOString() },
      { merge: true },
    );
    return { success: true, ad: result.ad };
  }

  async repostAd(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);

    try {
      await db.runTransaction(async (t) => {
        const doc = await t.get(adRef);
        if (!doc.exists) {
          throw new Error('Ad not found');
        }
        
        // Atomic integrity requirement: active -> pending
        t.update(adRef, { status: 'pending_repost' });
      });

      // Stub: Orchestrate Delete -> Verify -> Recreate via Automation Service
      // On success, automation worker will update lastPostedAt and nextRepostAt and set status back to 'active'

      return { success: true, message: 'Repost flow initiated' };
    } catch (error: any) {
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
      const newStatus = currentStatus === 'reserviert' ? 'active' : 'reserviert';
      
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
    await adRef.update({ status: 'Aktiv' });
    // Stub: call automation worker to activate ad on Kleinanzeigen
    return { success: true, message: 'Anzeige wurde aktiviert' };
  }

  async pauseAd(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
    await adRef.update({ status: 'Pausiert' });
    // Stub: call automation worker to pause ad on Kleinanzeigen
    return { success: true, message: 'Anzeige wurde pausiert' };
  }

  async deleteAd(userId: string, adId: string) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
    await adRef.delete();
    // Stub: call automation worker to delete ad on Kleinanzeigen
    return { success: true, message: 'Anzeige wurde gelöscht' };
  }

  async saveDraft(userId: string, adData: any) {
    const db = this.firebaseService.firestore;
    const adId = adData.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);

    const newAd = {
      ...adData,
      id: adId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await adRef.set(newAd, { merge: true });
    return { success: true, ad: newAd };
  }

  async updateAd(userId: string, adId: string, updateData: { title?: string; description?: string }) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);

    const doc = await adRef.get();
    if (!doc.exists) {
      throw new UnauthorizedException('Ad not found or does not belong to you');
    }

    const payload: any = {};
    if (updateData.title !== undefined) payload.title = updateData.title;
    if (updateData.description !== undefined) payload.description = updateData.description;

    if (Object.keys(payload).length > 0) {
      await adRef.update(payload);
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
