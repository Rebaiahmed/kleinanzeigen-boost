import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class AdsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async syncAds(userId: string) {
    // Stub: Calls Automation Service to scrape ads and upserts to Firestore
    return { success: true, message: 'Sync triggered successfully' };
  }

  async addAd(userId: string, adData: any) {
    // Stub: Triggers browser automation to post a new ad
    return { success: true, message: 'Ad creation triggered' };
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
}
