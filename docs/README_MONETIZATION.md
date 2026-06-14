# Monetization Strategy — Implementation Guide

**Status:** Ready to implement  
**Estimated implementation time:** 2–3 weeks (Phase 2) + 2 weeks (Phase 3)  
**Complexity:** Medium (Stripe integration, quota enforcement, UI messaging)

---

## Quick Start

### Current State
- ✅ All AI features exist and work
- ✅ Quota system already implemented (see `/backend/src/ai/ai-limits.constants.ts`)
- ✅ Feature flag `MONETIZATION_ENABLED` ready to flip
- ✅ Cost analysis complete (see docs in this folder)

### Next Steps

**This week:**
1. Decide on pricing (recommended: €4.99 Starter, €9.99 Pro)
2. Plan launch timeline (Week 5 for Starter, Week 9 for Pro)

**Week 5 (Starter launch):**
1. Integrate Stripe (2 days)
2. Wire up checkout flow (1 day)
3. Deploy + soft-launch (1 day)

**Week 9 (Pro launch):**
1. Hard limits enforcement (1 day)
2. Update UI messaging (1 day)
3. Deploy + monitor (1 day)

---

## Files to Read in This Folder

1. **COST_ANALYSIS_AND_PRICING_STRATEGY.md** (→ 15 min read)
   - Detailed cost breakdown for each feature
   - Per-user costs at different scales (5/20/50/100/500 users)
   - Complete pricing strategy with examples
   - 12-month financial projections

2. **PRICING_QUICK_REFERENCE.md** (→ 5 min read)
   - Tier comparison table
   - Revenue at scale scenarios
   - Upgrade triggers (soft & hard)
   - Quick messaging examples for users

3. **COST_SUMMARY.txt** (→ 3 min read)
   - Executive summary in plain text
   - One-page overview you can screenshot/share
   - Key metrics to monitor
   - Risk mitigation checklist

---

## Recommended Pricing (Summary)

### Tier Structure

| | **Free** | **Starter** | **Pro** |
|---|---|---|---|
| **Price** | €0 | €4.99/mo | €9.99/mo |
| **Photo AI** | 15/mo | 500/mo | ∞ |
| **Templates** | 3 total | ∞ | ∞ |
| **Auto-repost** | 3 ads | 15 ads | ∞ |
| **eBay** | — | — | ✅ |
| **Support** | Community | Email | Priority |

### Why This Works

- **Free tier:** Sustainable forever (marginal cost €0.22/user, covers Gemini free tier)
- **Starter (€4.99):** 33× upgrade in photo analyses (15→500) = clear value
- **Pro (€9.99):** Unlimited everything + exclusive features (eBay, priority support)
- **Margin:** 71–92% gross margin at scale

### Breakeven

- **25 Starter users** = €125/month revenue = covers all costs
- **Realistic timeline:** Month 2–3 (with 10–20% conversion from free tier)

---

## Implementation Roadmap

### Phase 1: Free Only (Now — Week 4)
**Goal:** Acquire 50 free users, validate demand

**Actions:**
- [ ] Remove any limits (set `MONETIZATION_ENABLED=false`)
- [ ] Create landing page + docs
- [ ] Launch product, get beta testers

**Monitoring:**
- Active users, feature usage per category
- Which features are most used? (determines paywall later)
- User feedback on value

---

### Phase 2: Add Starter Tier (Week 5–8)
**Goal:** Launch €4.99/month tier, achieve break-even

**Actions:**
1. [ ] **Stripe setup**
   - Create Stripe account
   - Define products: `kleinzeigen-boost-starter`, `kleinzeigen-boost-pro`
   - Create prices: €4.99/mo recurring, €9.99/mo recurring

2. [ ] **Backend integration** (2–3 hours)
   - `POST /billing/checkout` → Stripe Checkout Session
   - `POST /billing/webhook` → handle `checkout.session.completed`
   - Update `users/{id}.tier` in Firestore
   - Store `subscriptionId` + `status`

3. [ ] **Frontend integration** (4–5 hours)
   - Add "Upgrade" button in Settings
   - Soft nudges: "You've used 12/15 analyses. Learn more about Starter" (no enforcement)
   - Show tier badge in profile
   - Link to "Manage subscription" (Stripe portal)

4. [ ] **Launch**
   - Set `MONETIZATION_ENABLED=true` 
   - Deploy → beta testers first → gradual rollout

**Cost:** €9/mo VPS + €19/mo KLAZ (optional if users demand price suggestions)

**Success metric:** 10+ Starter users by end of week 8 (→ break-even at €50/mo)

---

### Phase 3: Add Pro + Hard Limits (Week 9–12)
**Goal:** Launch Pro tier, enforce free-tier limits

**Actions:**
1. [ ] **Hard limit enforcement** (2 hours)
   ```typescript
   // In ai.controller.ts, before analyzePhotos:
   if (!MONETIZATION_ENABLED) return; // soft launch only
   
   const effectiveLimit = getEffectiveLimit(user.tier, user.aiLimitBonus);
   if (aiUsageThisMonth >= effectiveLimit) {
     throw new HttpException(
       'Analyse-Limit erreicht. Upgrade für mehr.',
       HttpStatus.PAYMENT_REQUIRED, // 402
     );
   }
   ```

2. [ ] **Upgrade prompts** (6–8 hours)
   - Hard limit modal: "15/15 Analysen verbraucht. Starter für 500?"
   - Template limit: "3 Vorlagen max. Unlimited mit Starter"
   - Auto-repost limit: "4. Anzeige? Braucht Starter"

3. [ ] **Pro tier UI** (4–5 hours)
   - Show Pro tier in pricing page
   - Highlight exclusive features (eBay, priority support)
   - Add tier upgrade UI in Settings

4. [ ] **Deploy**
   - Roll out Pro tier to paying users
   - Hard limits on free tier (15 photos, 3 templates, 3 reposts)
   - Monitor conversion → Pro and churn from free tier

**Success metric:** 5+ Pro users by end of week 12 (→ +€50/mo revenue)

---

### Phase 4: Optimize (Month 4+)
**Goal:** Scale to 50+ Starter, 10+ Pro users

**Actions:**
- [ ] Analyze conversion by cohort (when did they convert? what triggered it?)
- [ ] A/B test pricing (try €3.99, €5.99 to find sweet spot)
- [ ] Improve onboarding (reduce churn)
- [ ] Consider annual billing (€49.90 Starter/year = 17% discount)
- [ ] Add educational content (ROI of features)

---

## Stripe Integration (Technical Brief)

### Required Environment Variables
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
```

### Key Endpoints to Build

**1. Checkout Session**
```
POST /billing/checkout?tier=starter
Header: Authorization: Bearer {token}

Response:
{
  "sessionUrl": "https://checkout.stripe.com/pay/cs_test_..."
}

Frontend: window.location.href = sessionUrl
```

**2. Webhook Handler**
```
POST /billing/webhook
Header: stripe-signature: ...

Handles:
- checkout.session.completed → Set user.tier, create subscription record
- customer.subscription.updated → Update subscription status
- customer.subscription.deleted → Downgrade user to free tier (or keep until period ends)
```

**3. Subscription Portal**
```
POST /billing/portal
Header: Authorization: Bearer {token}

Response:
{
  "portalUrl": "https://billing.stripe.com/..."
}

Frontend: window.location.href = portalUrl (manage/cancel)
```

### Cost of Stripe Integration
- No setup fee
- 2.9% + €0.30 per transaction
  - €4.99 charge → €0.45 fee → €4.54 net
  - €9.99 charge → €0.59 fee → €9.40 net
- Very acceptable for B2C SaaS

---

## Launch Messaging Examples

### Soft Nudge (Phase 2)
```
At 12/15 analyses:
┌─────────────────────────────────┐
│ 📸 Analysen: 12/15 verbraucht   │
├─────────────────────────────────┤
│ Mit Starter kriegst du 500      │
│ Analysen pro Monat.             │
│                                 │
│ [Mehr erfahren] [Jetzt kaufen]  │
└─────────────────────────────────┘
```

### Hard Limit (Phase 3)
```
At 15/15 analyses:
┌─────────────────────────────────┐
│ ❌ Analysen-Limit erreicht      │
├─────────────────────────────────┤
│ Du hast deine 15 kostenlosen    │
│ Analysen pro Monat verbraucht.  │
│                                 │
│ Mit Starter: 500 Analysen       │
│ Nur €4.99/Monat                 │
│                                 │
│ [Starter kaufen] [Später]       │
└─────────────────────────────────┘
```

### Pro Upsell (Contextual)
```
After 20 successful auto-reposts:
┌─────────────────────────────────┐
│ 🚀 Erfolg! 20 Auto-Neulisten    │
├─────────────────────────────────┤
│ Mit Pro erneuern sich alle      │
│ Anzeigen automatisch.           │
│                                 │
│ Spar 2h/Woche.                  │
│                                 │
│ [Pro ausprobieren] [Später]     │
└─────────────────────────────────┘
```

---

## Metrics Dashboard (What to Track)

### Business Metrics
- **MRR (Monthly Recurring Revenue)** = sum of all active subscriptions
- **Churn rate** = (customers lost this month) / (starting customers)
- **Conversion rate** = (new paid users) / (total free users)
- **ARPU (Average Revenue Per User)** = MRR / total users

### Product Metrics
- **DAU / WAU / MAU** = daily / weekly / monthly active users
- **Feature usage by tier** = which tier uses what features most?
- **Time to conversion** = how long before free user becomes Starter?
- **Support tickets** = do free, Starter, Pro differ?

### Cost Metrics
- **CAC (Customer Acquisition Cost)** = marketing spend / new customers
- **LTV (Lifetime Value)** = average revenue per user × average lifetime
- **LTV:CAC ratio** = should be >3.0 (you'll be >5.0 with organic launch)

---

## Go/No-Go Checklist

### Before Phase 2 (Starter Launch)

- [ ] Legal review: German pricing, VAT handling (Stripe Tax handles this)
- [ ] Stripe account created + keys in `.env`
- [ ] Backend `/billing/checkout` + webhook tested
- [ ] Frontend "Upgrade" button wired up
- [ ] Email setup for receipts (Stripe handles)
- [ ] Support email ready (for Starter tier)
- [ ] Pricing page updated with tier comparison
- [ ] At least 20 beta testers active

### Before Phase 3 (Pro Launch + Hard Limits)

- [ ] 10+ Starter users (proves tier works)
- [ ] Hard limit enforcement tested
- [ ] UI messaging finalized (translated to German)
- [ ] Churn analysis: why did users leave? (should be <5%)
- [ ] Pro features partially built (eBay, priority support)
- [ ] FAQ updated for paid tiers

---

## Common Questions

**Q: Won't hard limits hurt adoption?**
A: No. Hard limits appear only when you hit them. Most free users won't hit limits (15 analyses/month is generous). When they do, the nudge is contextual and valuable ("You love this feature, unlock it for €4.99").

**Q: Should I offer a free trial?**
A: Not immediately. Launch with soft limits (education only) for 2–4 weeks first. If conversion stalls <5%, add a 7-day free trial later.

**Q: What if users churn after paying?**
A: Stripe billing allows up to 3 automatic retry attempts. For failed payments, send email → "Please update your payment method." Most users will retry. Refund disputes are rare with recurring SaaS.

**Q: Can I offer family plans or team seats?**
A: Not in Phase 1. Too complex. Defer to Phase 4+ if demand exists.

**Q: How do I handle taxation (VAT)?**
A: Stripe Tax handles EU VAT automatically. You declare revenue in your home country. Consult a tax advisor for your specific situation.

---

## Success Criteria

### Month 1 (Free Phase)
- ✅ 50+ free users
- ✅ >2 photo analyses/user/week (proves engagement)
- ✅ 10% using auto-repost

### Month 2 (Starter Launch)
- ✅ 100+ free users
- ✅ 10+ Starter users (10% conversion)
- ✅ €50+ MRR
- ✅ <5% churn

### Month 3 (Before Pro Launch)
- ✅ 200+ free users
- ✅ 30+ Starter users (15% conversion)
- ✅ €150+ MRR
- ✅ 3–5% churn

### Month 6 (Post-Pro Launch)
- ✅ 500+ free users
- ✅ 100+ Starter users (20%)
- ✅ 30+ Pro users (6%)
- ✅ €600+ MRR
- ✅ <3% churn

---

## Timeline Summary

```
Now - Week 4:    PHASE 1 FREE ONLY
                 Cost: €9/mo
                 Goal: 50 users, validate demand

Week 5-8:        PHASE 2 ADD STARTER (€4.99)
                 Cost: €9 + €19 KLAZ = €28/mo
                 Goal: 10+ Starter users, break-even

Week 9-12:       PHASE 3 ADD PRO (€9.99) + HARD LIMITS
                 Cost: Same (€28/mo)
                 Goal: 5+ Pro users, profitable (€300+/mo)

Month 4-6:       PHASE 4 OPTIMIZE & GROW
                 Cost: €28-50/mo (VPS upgrade?)
                 Goal: 1,000+ free, 100+ Starter, 30+ Pro
                 Revenue: €600+/mo
```

---

## Next Action

→ **Read:** `/docs/COST_ANALYSIS_AND_PRICING_STRATEGY.md` (full analysis)  
→ **Review:** `/docs/PRICING_QUICK_REFERENCE.md` (quick summary)  
→ **Decide:** Which timeline works for your launch? Week 5 or later for Starter?  
→ **Announce:** Tell beta testers you're adding paid tiers (let them unlock features before paywall)

---

**Questions?** Review the docs above or run the cost analysis numbers for your specific scenario.
