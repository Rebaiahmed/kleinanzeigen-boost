import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { getPlanLimit, getEffectiveLimit } from '../config/ai-limits.constants';

@Injectable()
export class AdminService {
  constructor(private readonly firebaseService: FirebaseService) {}

  /** Lists every user joined with their current-month AI usage. */
  async getUsersUsage() {
    const db = this.firebaseService.firestore;
    const [usersSnap, usageSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('aiUsage').get(),
    ]);

    const usageById: Record<string, any> = {};
    for (const d of usageSnap.docs) usageById[d.id] = d.data();

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const users = usersSnap.docs.map((d) => {
      const u = d.data() || {};
      const plan = u.tier || u.plan || 'free';
      const bonus = u.aiLimitBonus || 0;
      const usage = usageById[d.id] || {};
      const sameMonth = usage.month === currentMonth;

      const planLimit = getPlanLimit(plan);
      const effectiveLimit = getEffectiveLimit(plan, bonus);

      return {
        userId: d.id,
        email: u.email || null,
        plan,
        bonus,
        planLimit: planLimit === Infinity ? null : planLimit,
        effectiveLimit: effectiveLimit === Infinity ? null : effectiveLimit,
        callsCount: sameMonth ? usage.callsCount || 0 : 0,
        promptTokens: sameMonth ? usage.promptTokens || 0 : 0,
        candidatesTokens: sameMonth ? usage.candidatesTokens || 0 : 0,
        estimatedCostUsd: sameMonth ? Number((usage.estimatedCostUsd || 0).toFixed(4)) : 0,
        byModel: sameMonth ? usage.byModel || {} : {},
        lastCallAt: usage.lastCallAt || null,
        month: usage.month || currentMonth,
      };
    });

    // Most active first
    users.sort((a, b) => b.callsCount - a.callsCount);
    return { count: users.length, month: currentMonth, users };
  }

  /** Sets a user's permanent monthly bonus (added on top of their plan limit). */
  async setAiLimitBonus(userId: string, bonus: number) {
    const db = this.firebaseService.firestore;
    const value = Math.max(0, Number(bonus) || 0);
    await db.collection('users').doc(userId).set({ aiLimitBonus: value }, { merge: true });
    return { userId, aiLimitBonus: value };
  }
}
