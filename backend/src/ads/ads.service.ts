import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';
import { EbayService } from '../ebay/ebay.service';
import { VintedService } from '../vinted/vinted.service';
import { ExtensionGateway } from '../auth/extension.gateway';

@Injectable()
export class AdsService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService,
    private readonly ebayService: EbayService,
    private readonly vintedService: VintedService,
    private readonly extensionGateway: ExtensionGateway
  ) {}

  async getAds(userId: string) {
    const db = this.firebaseService.firestore;
    const snapshot = await db.collection('users').doc(userId).collection('ads').get();
    const ads = snapshot.docs.map(doc => doc.data());
    return { success: true, ads };
  }

  async getSchedulerStatus() {
    const db = this.firebaseService.firestore;
    const doc = await db.collection('meta').doc('schedulerMeta').get();
    return { success: true, lastRunAt: doc.data()?.lastRunAt || null };
  }

  async syncAds(userId: string) {
    console.log(`[AdsService] syncAds called for user: ${userId}`);
    const db = this.firebaseService.firestore;
    
    // Check if user session exists and is active
    const sessionDoc = await db.collection('sessions').doc(userId).get();
    if (!sessionDoc.exists || sessionDoc.data()?.status !== 'active') {
      throw new UnauthorizedException('No active session found. Please log in again.');
    }

    // Direct command execution to Chrome Extension WebSocket
    if (!this.extensionGateway.isUserConnected(userId)) {
      throw new InternalServerErrorException('Chrome Extension ist nicht verbunden. Bitte installiere & aktiviere die Erweiterung.');
    }

    try {
      // Dispatch sync command to extension and await parsed ads array response
      const ads = await this.extensionGateway.sendCommand(userId, 'SYNC_ADS');
      
      if (!Array.isArray(ads)) {
        throw new Error('Ungültiges Antwortformat von der Chrome-Erweiterung.');
      }

      // Upsert ads to Firestore
      const batch = db.batch();
      for (const ad of ads) {
        const adRef = db.collection('users').doc(userId).collection('ads').doc(ad.id);
        batch.set(adRef, ad, { merge: true });
      }
      
      await batch.commit();

      return { success: true, message: 'Sync complete', ads };
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Fehler bei der Synchronisierung über die Chrome-Erweiterung.');
    }
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

  async updateAd(userId: string, adId: string, updateData: { title?: string; description?: string; repostIntervalMinutes?: number; nextRepostAt?: string; autoRepost?: boolean }) {
    const db = this.firebaseService.firestore;
    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);

    const doc = await adRef.get();
    if (!doc.exists) {
      throw new UnauthorizedException('Ad not found or does not belong to you');
    }

    const payload: any = {};
    if (updateData.title !== undefined) payload.title = updateData.title;
    if (updateData.description !== undefined) payload.description = updateData.description;
    if (updateData.repostIntervalMinutes !== undefined) payload.repostIntervalMinutes = updateData.repostIntervalMinutes;
    if (updateData.nextRepostAt !== undefined) payload.nextRepostAt = updateData.nextRepostAt;
    if (updateData.autoRepost !== undefined) payload.autoRepost = updateData.autoRepost;

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
