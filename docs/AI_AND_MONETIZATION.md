# AI Usage, Models & Monetization

Covers roadmap tasks 4.1–4.4.

- **4.1 / 4.2 are documentation of what's already built** (source of truth: `backend/src/config/ai-limits.constants.ts` and `backend/src/ai/ai.service.ts`).
- **4.3 / 4.4 are proposals / decisions** — nothing is implemented yet; treat the numbers as a starting point.

---

## 4.1 — AI Credits / Limits per Plan ✅ implemented

**What counts against the limit:** only **photo analysis** (`/ai/analyze-photos`) is *metered*. Cheap text operations (ad optimization, price suggestion, reply-template generation) are tracked for analytics but **do not consume** the monthly quota.

| Plan | Monthly AI photo analyses | Reply templates |
|------|---------------------------|-----------------|
| **Free** | **15** | **3** |
| **Starter** | **500** | unlimited |
| **Pro** / unlimited | **∞ (unlimited)** | unlimited |

- **Effective limit = plan limit + per-user bonus.** Admins can grant a permanent monthly bonus per user (`users/{id}.aiLimitBonus`) via `PATCH /admin/users/:id/ai-limit`.
- **Env-overridable:** `AI_LIMIT_FREE` (default 15), `AI_LIMIT_STARTER` (default 500), `FREE_TEMPLATE_LIMIT` (default 3).
- **Reset:** monthly, tracked in Firestore `aiUsage/{userId}` (`callsCount`, `month`).
- **Enforcement:** `analyzePhotos` throws `429 PLAN_LIMIT_REACHED` when `callsCount >= effectiveLimit`. The frontend shows an upgrade prompt.
- **Plan source:** `users/{id}.tier` (or `.plan`), normalized lowercase. Unknown plans default to **free**.

## 4.2 — Which AI Models Are Used ✅ implemented

Two providers, tried **free-first** in a fallback chain (`executeWithFallback`). If a model fails (error, rate-limit, no credits), the next is tried automatically.

**Vision filtering:** when the request contains images (photo analysis), text-only models are skipped automatically.

| Order | Model | Provider | Cost (in/out per 1M) | Vision |
|-------|-------|----------|----------------------|--------|
| 1 | `gemini-2.0-flash` | Google direct (free tier) | $0 | ✅ |
| 2 | `google/gemma-4-31b-it:free` | OpenRouter (free) | $0 | text-only |
| 3 | `meta-llama/llama-3.3-70b-instruct:free` | OpenRouter (free) | $0 | text-only |
| 4 | `google/gemini-2.5-flash-lite` | OpenRouter (paid) | $0.10 / $0.40 | ✅ |
| 5 | `qwen/qwen3-235b-a22b-2507` | OpenRouter (paid) | $0.09 / $0.10 | text-only |
| 6 | `gemini-2.5-flash` | Google direct | $0.30 / $2.50 | ✅ |
| 7 | `openai/gpt-4o-mini` | OpenRouter (paid) | $0.15 / $0.60 | ✅ |
| 8 | `x-ai/grok-3-mini` | OpenRouter (paid) | $0.30 / $0.50 | text-only |
| 9 | `deepseek/deepseek-chat` | OpenRouter (paid) | $0.27 / $1.10 | text-only |

- **Keys:** `GEMINI_API_KEY` (Google direct — must be a real AI Studio key starting with `AIza`, not a depleted prepaid key) and `OPENROUTER_API_KEY`.
- **Cost tracking:** per-model token usage + estimated cost is recorded per user (`aiUsage/{userId}.byModel`, `.estimatedCostUsd`) and surfaced in the admin endpoint. Prices live in `MODEL_PRICING`.
- **Current cost reality:** with Gemini's free tier active, real spend is ≈ $0. Paid OpenRouter fallbacks only activate if the account has credits.
- **Note:** reply-template generation currently calls `gemma-4-31b-it:free` directly (not the shared chain).

---

## 4.3 — Payment Setup ⚠️ NOT implemented (decision needed)

There is **no payment integration today.** Plans exist as a `tier` field on the user, but nothing sets it via a paid checkout.

**Recommendation: Stripe** (over PayPal) for a German SaaS:
- Native **recurring subscriptions** (Stripe Billing) — PayPal subscriptions are clunkier.
- **SEPA Direct Debit + cards + Apple/Google Pay** — SEPA matters in DE.
- **Stripe Tax** handles EU VAT automatically (you'll need this once revenue grows).
- Clean webhooks to flip `users/{id}.tier` on `checkout.session.completed` / `customer.subscription.updated/deleted`.

**Minimal integration plan (future ticket):**
1. Create products/prices in Stripe (Starter, Pro — monthly).
2. Backend: `POST /billing/checkout` → Stripe Checkout Session; `POST /billing/portal` → customer portal.
3. Webhook `POST /billing/webhook` → verify signature, map subscription → set `users/{id}.tier` + `subscriptionStatus`.
4. Frontend: "Upgrade" buttons → checkout; "Manage subscription" → portal.
5. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs.

**Donations (already live):** Buy Me a Coffee button in Settings (`VITE_BUYMEACOFFEE_URL`). This is *not* monetization — keep it separate from subscriptions.

## 4.4 — Monetization Strategy 📝 proposed

**Model:** Freemium subscription. Free tier hooks via the AI "wow" + a taste of auto-repost; paid tiers unlock volume + cross-posting.

**Proposed pricing (German market, starting point — validate with users):**

| | **Free** | **Starter ~€4.99/mo** | **Pro ~€9.99/mo** |
|---|---|---|---|
| AI photo listings / mo | 15 | 500 | unlimited |
| Auto-repost | up to ~3 ads | up to ~25 ads | unlimited |
| Reply templates | 3 | unlimited | unlimited |
| eBay cross-post | — | ✅ | ✅ |
| Vinted templates | ✅ | ✅ | ✅ |
| Support | community | email | priority |

> The AI limits (15 / 500 / ∞) are **already enforced in code**. The auto-repost ad-count caps are a **proposed** lever — not yet enforced; would need a per-plan `maxAutoRepostAds` check in the scheduler.

**Why this works:** your marginal cost is near zero (Gemini free tier + a fixed VPS), so a generous free tier is cheap to offer and drives acquisition; the paywall is *volume* (heavy sellers) and *cross-posting*, which correlate with users who make money from reselling and will happily pay €5–10.

**Upgrade prompts (conversion levers):**
- At the limit: "Kostenloses Limit erreicht (15/15) — Upgrade für mehr" (already wired for AI + templates).
- Contextual: when a free user tries eBay cross-post or a 4th template → inline "Pro feature" nudge.
- Value-framed (POST-SMARTER epic): "Pro-Verkäufer verkaufen X% schneller" educational prompts (#21).
- Usage milestone: after N successful reposts, "Du hast X Aufrufe gewonnen — mit Pro automatisierst du alles."

**Sequencing:** ship free-only → validate demand → add Stripe + the two paid tiers → introduce the auto-repost ad-count caps last (so early users aren't annoyed before there's a reason to pay).
