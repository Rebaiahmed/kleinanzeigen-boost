import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService
  ) {}

  @Cron('*/1 * * * *') // Runs every 1 minute
  async handleRepostCron() {
    this.logger.log('Running scheduled repost check...');
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

        if (adsSnapshot.empty) continue;

        // Fetch session cookies for view scraping
        let cookies: any[] = [];
        try {
          const sessionDoc = await db.collection('sessions').doc(userId).get();
          if (sessionDoc.exists) {
            cookies = sessionDoc.data()?.marketplaceCookies || [];
          }
        } catch (e: any) {
          this.logger.warn(`Could not fetch session for user ${userId}: ${e.message}`);
        }

        for (const adDoc of adsSnapshot.docs) {
          const adId = adDoc.id;
          const adData = adDoc.data();

          // Read per-ad interval (fallback: 1440 min = 24 h)
          const repostIntervalMinutes: number = adData.repostIntervalMinutes ?? 1440;
          
          this.logger.log(`Initiating automated repost for Ad: ${adId} (User: ${userId})`);

          // 1. Atomic state lock
          await db.runTransaction(async (t) => {
            const ref = db.collection('users').doc(userId).collection('ads').doc(adId);
            t.update(ref, { status: 'pending_repost' });
          });

          // 2. Fetch viewsBefore
          let viewsBefore = 0;
          if (cookies.length > 0) {
            try {
              const viewsResult = await this.automationService.callAutomationWorker('scrape-views', { userId, cookies, adId });
              if (viewsResult.success && typeof viewsResult.views === 'number') {
                viewsBefore = viewsResult.views;
              }
            } catch (e: any) {
              this.logger.warn(`Failed to get viewsBefore for ${adId}: ${e.message}`);
            }
          }

          const startTime = Date.now();

          // 3. Trigger worker
          try {
            const result = await this.automationService.callAutomationWorker('repost', { userId, adId, adData });
            
            // 4. On success, update state and create log
            if (result.success) {
              const nextRepostAt = new Date(
                Date.now() + repostIntervalMinutes * 60 * 1000,
              ).toISOString();

              await db.collection('users').doc(userId).collection('ads').doc(adId).update({
                status: 'active',
                lastPostedAt: new Date().toISOString(),
                nextRepostAt,
              });

              // Create repostLogs document
              await db.collection('users').doc(userId).collection('ads').doc(adId).collection('repostLogs').add({
                status: 'success',
                executedAt: new Date().toISOString(),
                durationMs: Date.now() - startTime,
                viewsBefore,
                viewsAfter: null
              });

              this.logger.log(`Repost scheduled: next in ${repostIntervalMinutes} minutes`);
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

        // Fetch session cookies once per user
        let cookies: any[] = [];
        try {
          const sessionDoc = await db.collection('sessions').doc(userId).get();
          if (sessionDoc.exists) {
            cookies = sessionDoc.data()?.marketplaceCookies || [];
          }
        } catch (e: any) {
          continue;
        }

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
                const viewsResult = await this.automationService.callAutomationWorker('scrape-views', { userId, cookies, adId });
                if (viewsResult.success && typeof viewsResult.views === 'number') {
                  const viewsAfter = viewsResult.views;
                  const viewsBefore = logData.viewsBefore || 0;
                  const viewsGained = Math.max(0, viewsAfter - viewsBefore);

                  await logDoc.ref.update({
                    viewsAfter,
                    viewsGained
                  });

                  // Update parent ad document stats (trackedRepostsCount, lastRepostViewsGained, bestDayBisher, bestHourBisher)
                  try {
                    const adRef = db.collection('users').doc(userId).collection('ads').doc(adId);
                    
                    // Fetch all completed logs to calculate stats
                    const allLogsSnapshot = await adRef.collection('repostLogs').get();
                    const allLogs = allLogsSnapshot.docs.map(d => d.data());
                    
                    // Filter logs with viewsGained
                    const completedLogs = allLogs.filter(log => 
                      log.viewsAfter !== null && log.viewsAfter !== undefined &&
                      log.viewsBefore !== null && log.viewsBefore !== undefined
                    );

                    const trackedRepostsCount = completedLogs.length;

                    // Get last repost views gained
                    let lastRepostViewsGained = 0;
                    if (completedLogs.length > 0) {
                      // Sort descending by execution date
                      const sortedLogs = [...completedLogs].sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
                      lastRepostViewsGained = sortedLogs[0].viewsGained || 0;
                    }

                    // Get best day and hour based on completed logs
                    let bestDayBisher = '';
                    let bestHourBisher: number | null = null;
                    if (completedLogs.length > 0) {
                      // Find completed log with max viewsGained
                      const bestLog = completedLogs.reduce((max, current) => 
                        (current.viewsGained || 0) > (max.viewsGained || 0) ? current : max
                      , completedLogs[0]);

                      const d = new Date(bestLog.executedAt);
                      const deDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
                      bestDayBisher = deDays[d.getDay()];
                      bestHourBisher = d.getHours();
                    }

                    await adRef.update({ 
                      trackedRepostsCount,
                      lastRepostViewsGained,
                      ...(bestDayBisher ? { bestDayBisher, bestHourBisher } : {})
                    });
                  } catch (e: any) {
                    this.logger.warn(`Failed to update stats for ad ${adId}: ${e.message}`);
                  }

                  this.logger.log(`Updated views for repostLog ${logDoc.id} of ad ${adId}: +${viewsGained} views`);
                }
              } catch (e: any) {
                this.logger.warn(`Failed to track views for ad ${adId}: ${e.message}`);
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
