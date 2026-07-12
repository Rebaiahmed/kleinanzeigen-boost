import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

/**
 * TODO(credits-stripe): feature/credits-stripe is not merged into main yet,
 * so this whole class is a stand-in for the real CreditsService. Once that
 * branch lands:
 *   - add `competitor_tracking: ADDITIONAL_SEARCH_CREDIT_COST` to
 *     CREDIT_COSTS (backend/src/config/credit-costs.constants.ts on that
 *     branch)
 *   - replace reserveForPaidSearch()'s body with
 *     `await this.creditsService.reserve(userId, 'competitor_tracking', relatedActionId)`
 *   - delete this file, inject the real CreditsService into
 *     WettbewerbService instead.
 * canCreateFreeSearch/markFreeSearchUsed need no credits system at all —
 * they're plain Firestore bookkeeping and can stay as-is.
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
