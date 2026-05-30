import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService
  ) {}

  @Cron('*/10 * * * *') // Runs every 10 minutes
  async handleRepostCron() {
    this.logger.log('Running scheduled repost check...');
    const db = this.firebaseService.firestore;
    const now = new Date().toISOString();

    try {
      // Find all users
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        
        // Find due ads for this user
        const adsSnapshot = await db.collection('users').doc(userId).collection('ads')
          .where('autoRepost', '==', true)
          .where('nextRepostAt', '<=', now)
          .where('status', '==', 'active')
          .get();

        for (const adDoc of adsSnapshot.docs) {
          const adId = adDoc.id;
          const adData = adDoc.data();
          
          this.logger.log(`Initiating automated repost for Ad: ${adId} (User: ${userId})`);

          // 1. Atomic state lock
          await db.runTransaction(async (t) => {
            const ref = db.collection('users').doc(userId).collection('ads').doc(adId);
            t.update(ref, { status: 'pending_repost' });
          });

          // 2. Trigger worker
          try {
            const result = await this.automationService.callAutomationWorker('repost', { userId, adId, adData });
            
            // 3. On success, update state
            if (result.success) {
              await db.collection('users').doc(userId).collection('ads').doc(adId).update({
                status: 'active',
                lastPostedAt: new Date().toISOString(),
                // Simplistic next calculate, usually fetched from Ad schema intervals
                nextRepostAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              });
            }
          } catch (error: any) {
            this.logger.error(`Repost failed for ${adId}: ${error.message}`);
            
            // Handle Session Trap
            if (error.message === 'SESSION_EXPIRED') {
              await db.collection('users').doc(userId).update({ accountStatus: 'expired' });
              // Revert ad status
              await db.collection('users').doc(userId).collection('ads').doc(adId).update({ status: 'active' });
              // Stop processing for this user
              break; 
            } else {
              // Standard failure, revert status
              await db.collection('users').doc(userId).collection('ads').doc(adId).update({ status: 'active' });
            }
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Cron iteration failed: ${error.message}`);
    }
  }
}
