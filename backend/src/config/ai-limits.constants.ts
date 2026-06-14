/**
 * Single source of truth for AI usage limits and cost estimation.
 * Replaces the previously duplicated (and conflicting) hardcoded limits.
 */

/**
 * Master monetization switch. While OFF (default), all plan limits are treated
 * as unlimited — no quota enforcement, no upgrade prompts — so the app runs
 * free-for-all during the launch phase. Flip MONETIZATION_ENABLED=true to
 * activate plan limits and paywalls when you're ready to charge.
 */
export const MONETIZATION_ENABLED = process.env.MONETIZATION_ENABLED === 'true';

/** Monthly metered AI calls per plan. Only photo analysis is metered today. */
export const AI_PLAN_LIMITS: Record<string, number> = {
  free: Number(process.env.AI_LIMIT_FREE) || 50,      // Phase 1: soft limit (no enforcement), track usage
  starter: Number(process.env.AI_LIMIT_STARTER) || 500,
  pro: Infinity,
  unlimited: Infinity,
};

/** Max reply templates a free-plan user may store. */
export const FREE_TEMPLATE_LIMIT = Number(process.env.FREE_TEMPLATE_LIMIT) || 10;  // Phase 1: soft limit, track usage

export function getPlanLimit(plan?: string): number {
  const key = (plan || 'free').toLowerCase();
  return AI_PLAN_LIMITS[key] ?? AI_PLAN_LIMITS.free;
}

/** Effective limit = plan limit + per-user permanent monthly bonus.
 *  Even when MONETIZATION_ENABLED=false, returns the configured limit for testing.
 *  This allows testing quota behavior without flipping the monetization switch. */
export function getEffectiveLimit(plan?: string, bonus = 0): number {
  const base = getPlanLimit(plan);
  return base === Infinity ? Infinity : base + (Number(bonus) || 0);
}

/**
 * Approximate USD price per 1M tokens, {in: prompt, out: completion}.
 * Free tiers are 0. These drift over time — treat the cost figure as a rough
 * estimate for relative comparison between users, not billing-grade accuracy.
 */
export const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  'gemini-2.0-flash': { in: 0, out: 0 },          // free tier
  'gemini-2.5-flash': { in: 0.30, out: 2.50 },
  'google/gemini-2.5-flash-lite': { in: 0.10, out: 0.40 },
  'qwen/qwen3-235b-a22b-2507': { in: 0.09, out: 0.10 },
  'google/gemma-4-31b-it:free': { in: 0, out: 0 },
  'meta-llama/llama-3.3-70b-instruct:free': { in: 0, out: 0 },
  'x-ai/grok-3-mini': { in: 0.30, out: 0.50 },
  'openai/gpt-4o-mini': { in: 0.15, out: 0.60 },
  'deepseek/deepseek-chat': { in: 0.27, out: 1.10 },
  'meta-llama/llama-3.3-70b-instruct': { in: 0.12, out: 0.30 },
};

export function estimateCostUsd(model: string, promptTokens: number, candidatesTokens: number): number {
  const p = MODEL_PRICING[model] || { in: 0, out: 0 };
  return (promptTokens / 1_000_000) * p.in + (candidatesTokens / 1_000_000) * p.out;
}
