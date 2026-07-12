import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreditActionType, getCreditCost } from '../config/credit-costs.constants';

export type CreditTransactionType = 'grant' | 'deduction' | 'refund' | 'purchase';

interface CreditTransaction {
  type: CreditTransactionType;
  amount: number;
  reason: string;
  relatedActionId: string | null;
  timestamp: string;
  balanceAfter: number;
  stripeEventId?: string;
  stripePackId?: string;
}

const STALE_RESERVATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generic credit wallet — deliberately reusable, not hardcoded to any one
 * action type. New features just add a cost to credit-costs.constants.ts
 * and call deduct()/reserve() with their own action name.
 */
@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  private userRef(userId: string) {
    return this.firebaseService.firestore.collection('users').doc(userId);
  }

  async getBalance(userId: string): Promise<number> {
    const doc = await this.userRef(userId).get();
    return doc.data()?.credits ?? 0;
  }

  /** One-time 50-credit signup grant. Idempotent — safe to call on every
   *  balance check; no-ops after the first successful call for a user. */
  async ensureInitialized(userId: string): Promise<void> {
    const userRef = this.userRef(userId);
    await this.firebaseService.firestore.runTransaction(async (t: any) => {
      const doc = await t.get(userRef);
      if (doc.data()?.creditsInitialized === true) return;
      const amount = 50;
      t.set(userRef, { credits: amount, creditsInitialized: true }, { merge: true });
      t.set(userRef.collection('creditTransactions').doc(), {
        type: 'grant', amount, reason: 'signup_bonus', relatedActionId: null,
        timestamp: new Date().toISOString(), balanceAfter: amount,
      } as CreditTransaction);
    });
  }

  /** Atomic balance adjustment + transaction log entry. `checkSufficient`
   *  rejects with 402 if the resulting balance would go negative — used by
   *  deduct only; refund/grant always succeed. */
  private async adjustBalance(
    userId: string,
    delta: number,
    type: CreditTransactionType,
    reason: string,
    relatedActionId: string | null,
    checkSufficient: boolean,
    extra: Partial<CreditTransaction> = {},
  ): Promise<{ balance: number }> {
    const userRef = this.userRef(userId);
    let newBalance = 0;
    await this.firebaseService.firestore.runTransaction(async (t: any) => {
      const doc = await t.get(userRef);
      const current = doc.data()?.credits ?? 0;
      if (checkSufficient && current + delta < 0) {
        throw new HttpException(
          { message: 'Nicht genügend Credits.', code: 'INSUFFICIENT_CREDITS', balance: current },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      newBalance = current + delta;
      t.set(userRef, { credits: newBalance }, { merge: true });
      t.set(userRef.collection('creditTransactions').doc(), {
        type, amount: Math.abs(delta), reason, relatedActionId,
        timestamp: new Date().toISOString(), balanceAfter: newBalance,
        ...extra,
      } as CreditTransaction);
    });
    return { balance: newBalance };
  }

  /** Rejects (402) if the user doesn't have enough credits. */
  async deduct(userId: string, amount: number, reason: string, relatedActionId: string | null = null) {
    return this.adjustBalance(userId, -amount, 'deduction', reason, relatedActionId, true);
  }

  /** Never rejects on balance — a refund always lands. */
  async refund(userId: string, amount: number, reason: string, relatedActionId: string | null = null) {
    return this.adjustBalance(userId, amount, 'refund', reason, relatedActionId, false);
  }

  /** Generic top-up (manual grants, admin adjustments). */
  async grant(userId: string, amount: number, reason: string, relatedActionId: string | null = null) {
    return this.adjustBalance(userId, amount, 'grant', reason, relatedActionId, false);
  }

  /** Idempotent Stripe purchase credit — a stripeWebhookEvents/{eventId} doc
   *  written in the SAME transaction as the balance increment acts as the
   *  dedup lock, so retried webhook deliveries never double-credit. */
  async grantFromStripeEvent(
    eventId: string,
    metadata: { userId: string; packId: string; credits: string },
  ): Promise<void> {
    const db = this.firebaseService.firestore;
    const eventRef = db.collection('stripeWebhookEvents').doc(eventId);
    const userRef = this.userRef(metadata.userId);
    await db.runTransaction(async (t: any) => {
      const eventDoc = await t.get(eventRef);
      if (eventDoc.exists) {
        this.logger.log(`Stripe event ${eventId} already processed — skipping (idempotent)`);
        return;
      }
      const userDoc = await t.get(userRef);
      const current = userDoc.data()?.credits ?? 0;
      const amount = Number(metadata.credits) || 0;
      const newBalance = current + amount;
      t.set(eventRef, {
        processedAt: new Date().toISOString(), userId: metadata.userId, packId: metadata.packId, amount,
      });
      t.set(userRef, { credits: newBalance }, { merge: true });
      t.set(userRef.collection('creditTransactions').doc(), {
        type: 'purchase', amount, reason: 'stripe_purchase', relatedActionId: null,
        timestamp: new Date().toISOString(), balanceAfter: newBalance,
        stripeEventId: eventId, stripePackId: metadata.packId,
      } as CreditTransaction);
    });
  }

  /**
   * Reservation pattern for actions whose success/failure is only known
   * client-side (e.g. the extension's own DOM-automation repost flow) and
   * may never call confirm() back if the client crashes mid-action. Deducts
   * immediately (atomic with the reservation record), so the credit is gone
   * from the balance right away — confirm() either releases the reservation
   * (success) or refunds (failure). cleanupStaleReservations() is the
   * crash-safety net for reservations that never get confirmed.
   */
  async reserve(userId: string, actionType: CreditActionType, relatedActionId: string) {
    const amount = getCreditCost(actionType);
    const db = this.firebaseService.firestore;
    const userRef = this.userRef(userId);
    const reservationRef = db.collection('pendingReservations').doc(relatedActionId);
    let newBalance = 0;
    await db.runTransaction(async (t: any) => {
      const existing = await t.get(reservationRef);
      if (existing.exists) {
        // Same relatedActionId reserved twice (e.g. retried request) — no-op,
        // return the balance as-is rather than double-deducting.
        const doc = await t.get(userRef);
        newBalance = doc.data()?.credits ?? 0;
        return;
      }
      const userDoc = await t.get(userRef);
      const current = userDoc.data()?.credits ?? 0;
      if (current < amount) {
        throw new HttpException(
          { message: 'Nicht genügend Credits.', code: 'INSUFFICIENT_CREDITS', balance: current },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      newBalance = current - amount;
      t.set(userRef, { credits: newBalance }, { merge: true });
      t.set(userRef.collection('creditTransactions').doc(), {
        type: 'deduction', amount, reason: actionType, relatedActionId,
        timestamp: new Date().toISOString(), balanceAfter: newBalance,
      } as CreditTransaction);
      t.set(reservationRef, {
        userId, actionType, amount, reason: actionType,
        createdAt: new Date().toISOString(), status: 'pending',
      });
    });
    return { balance: newBalance };
  }

  /** success:false refunds the reserved amount; success:true just releases
   *  the reservation record (the deduction already stands). Safe to call
   *  more than once for the same relatedActionId (no-ops if already gone). */
  async confirm(relatedActionId: string, success: boolean): Promise<void> {
    const db = this.firebaseService.firestore;
    const reservationRef = db.collection('pendingReservations').doc(relatedActionId);
    const doc = await reservationRef.get();
    if (!doc.exists) {
      this.logger.warn(`confirm() called for unknown/already-settled reservation ${relatedActionId}`);
      return;
    }
    const { userId, amount, reason } = doc.data() as any;
    if (!success) {
      await this.refund(userId, amount, `${reason}_failed`, relatedActionId);
    }
    await reservationRef.delete();
  }

  /** Crash-safety sweep — refunds + removes any reservation older than
   *  STALE_RESERVATION_MS that never got confirmed. Called from a cron tick
   *  in SchedulerService. */
  async cleanupStaleReservations(): Promise<number> {
    const db = this.firebaseService.firestore;
    const cutoff = new Date(Date.now() - STALE_RESERVATION_MS).toISOString();
    const snap = await db.collection('pendingReservations').where('createdAt', '<=', cutoff).get();
    let cleaned = 0;
    for (const d of snap.docs) {
      const { userId, amount, reason } = d.data() as any;
      try {
        await this.refund(userId, amount, `${reason}_stale_reservation`, d.id);
        await d.ref.delete();
        cleaned++;
      } catch (err: any) {
        this.logger.error(`Failed to clean up stale reservation ${d.id}: ${err.message}`);
      }
    }
    if (cleaned > 0) this.logger.warn(`Cleaned up ${cleaned} stale credit reservation(s)`);
    return cleaned;
  }
}
