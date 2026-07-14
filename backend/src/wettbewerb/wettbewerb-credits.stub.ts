import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

/**
 * Stub for Wettbewerb (competitor tracker) credits — handles free search allowance.
 * When ENABLE_CREDITS=true and the real credits system is fully integrated,
 * this stub can be replaced with calls to the real CreditsService.
 *
 * For now: competitor tracking is free (uses one free search per user).
 * reserveForPaidSearch() is a no-op until credits are wired up.
 */
@Injectable()
export class WettbewerbCreditsStub {
  constructor(private readonly firebaseService: FirebaseService) {}

  async canCreateFreeSearch(userId: string): Promise<boolean> {
    const doc = await this.firebaseService.firestore.collection('users').doc(userId).get();
    return doc.data()?.wettbewerbFreeSearchUsed !== true;
  }

  async markFreeSearchUsed(userId: string): Promise<void> {
    await this.firebaseService.firestore
      .collection('users')
      .doc(userId)
      .set({ wettbewerbFreeSearchUsed: true }, { merge: true });
  }

  /**
   * TODO(credits-stripe): always throws until the real credits system is
   * wired in. Deliberately not faking a successful purchase — the frontend
   * upsell card surfaces this error's `message` instead of pretending the
   * purchase worked. Net effect until credits-stripe merges: hard cap of 1
   * saved search per user, which is expected and was explicitly flagged to
   * the user during planning.
   */
  async reserveForPaidSearch(_userId: string, _relatedActionId: string): Promise<never> {
    throw new HttpException(
      {
        message: 'Weitere Suchen sind bald verfügbar — das Credits-System wird gerade fertiggestellt.',
        code: 'CREDITS_NOT_AVAILABLE',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
