# Cost Analysis & Pricing Strategy

**Last updated:** 2026-06-14  
**Currency:** EUR (€) with USD conversions (1 USD ≈ 0.92 EUR)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Your monthly fixed cost** | €9 (VPS only, when on free tiers) |
| **Breakeven users** | ~50 (at €4.99/mo Starter tier) |
| **Free tier sustainable?** | ✅ Yes, indefinitely (Gemini free + KLAZ free tier) |
| **Recommended pricing** | Free (0€), Starter (€4.99), Pro (€9.99) |
| **Target margin** | 60–70% gross margin at 50+ users |

---

## Part 1: Per-Feature Cost Breakdown

### A. Photo Feedback (Vision AI)

**Feature:** `/ai/analyze-photos` — analyzes 3–5 images per ad, scores lighting, clarity, background, composition, coverage.

**Cost per analysis:**
```
Typical call:
- 4 images @ 500KB each (JPEG)
- Prompt: ~200 tokens
- Response: ~300 tokens
- Model: Gemini 2.0 Flash (free tier first)

Cost estimate:
- Free tier (Gemini): $0 ✅
- Fallback (OpenRouter Gemini 2.5 Flash Lite): $0.0003–0.0005 per call
```

**User behavior estimate:**
- Free user: 2–3 analyses/month (stays under 15 limit)
- Starter user: 10–15 analyses/month
- Pro user: unlimited (30–50/month realistic)

**Monthly cost per user segment:**
```
Free user:     $0 (Gemini free tier covers it)
Starter user:  $0–0.01 (mostly Gemini free, rare fallback)
Pro user:      $0–0.05 (occasional fallback)
```

**Total cost for 100 users (mixed tiers):**
```
Assume: 60% free, 30% Starter, 10% Pro
= (60 × 0) + (30 × 0.005) + (10 × 0.03)
= $0.21/month on OpenRouter (when Gemini free tier exhausted)
```

---

### B. Price Suggestion (Text LLM + KLAZ API)

**Feature:** `/ai/suggest-price` — fetches ~30 comparable listings via KLAZ API, LLM filters & suggests price range.

**Cost per suggestion:**
```
1. KLAZ API search:        ~€0.02 (1 credit @ €0.02 per credit, Starter tier)
2. LLM analysis:           $0 (free tier Gemini or Gemma)
3. Fallback LLM (rare):    $0.0001–0.0005

Total: €0.02–0.03 per suggestion
```

**User behavior:**
- Free user: 1–2 suggestions/month (free KLAZ tier gives 50 credits + 5/day)
- Starter user: 3–5 suggestions/month
- Pro user: 10–20 suggestions/month (pays for KLAZ Starter tier)

**Monthly cost per user segment:**
```
Free user:     €0 (free KLAZ tier covers ~150 total searches/month for all free users)
Starter user:  €0.06–0.10 (KLAZ split cost)
Pro user:      €0.20–0.60 (KLAZ split cost)

Shared KLAZ Starter cost: €19/month ÷ N users = amortized
```

**Scenario: 100 users, 25% Pro tier using price suggestions:**
```
Pro users making price suggestions: 25 users × 15 suggestions = 375 suggestions/month
KLAZ Starter tier: €19/month
Cost per suggestion: €19 ÷ 375 = €0.05 per suggestion
```

---

### C. Reply Templates (Text LLM)

**Feature:** `/ai/reply-template` — generates ready-to-use responses to buyer messages.

**Cost per template:**
```
Prompt: ~150 tokens
Response: ~100 tokens
Model: Gemma 4 (free) or fallback Gemini Flash (free)

Cost: $0
```

**User behavior:**
- Free user: 2–3 templates/month (limit: 3)
- Starter/Pro: unlimited (realistically 5–10/month)

**Monthly cost per user:**
```
Free user:     $0
Starter user:  $0
Pro user:      $0
```

---

### D. Ad Optimization (Text LLM)

**Feature:** `/ai/optimize-ad` — suggests title/description improvements for SEO & appeal.

**Cost per optimization:**
```
Prompt: ~300 tokens (ad title + description analysis)
Response: ~200 tokens
Model: Free tier Gemini 2.0

Cost: $0
```

**User behavior:**
- Free user: 1–2 optimizations/month
- Starter/Pro: 5–10/month

**Monthly cost per user:** $0 (all covered by Gemini free tier)

---

### E. Auto-Repost Scheduler

**Feature:** Background job that re-lists expired ads automatically.

**Cost:**
```
VPS-based: ~€0.50–1.00 per user/month (included in €9/month VPS)
- Playwright browser (low memory footprint per process)
- Cron schedule (minimal CPU for 5–10 ads per user)
- Session management (Firestore + Redis if needed)

Database reads/writes:
- Per repost: 2–3 Firestore reads + 1 write
- User with 10 auto-reposts/month: ~30 operations
- 100 users: 3,000 operations = well under free tier (50K reads/day)
```

**Cost per user:** €0.15–0.25 (amortized from €9 VPS)

---

### F. Firebase (Firestore + Storage)

**Current usage (free tier):**
```
- Reads: ~1–2K per user/month = 100K–200K for 100 users ✓ under 50K/day limit
- Writes: ~300–500 per user/month = 30K–50K for 100 users ✓ under 20K/day limit
- Storage: ~100MB per user (photos + backups) = 10GB for 100 users
```

**Pricing when free tier exhausted:**
```
Reads:  $0.06 per 100K = $1.50–3.00/month for 100 users
Writes: $0.18 per 100K = $0.50–0.90/month for 100 users
Storage: $0.18 per GB/month = $1.80 for 10GB
Total:   ~$5/month for 100 users
```

---

## Part 2: Total Cost Per User (Monthly)

### Assumptions

```
User profile (median):
- 5 ads per month
- 2 photo analyses
- 1 price suggestion
- 2 reply templates
- 1 ad optimization
- 5 auto-reposts

Free tier is Gemini (always first), fallback to OpenRouter 10% of time
KLAZ free tier covers first ~150 searches across all free users
Firebase on free tier
```

### Cost Table

| Component | Free User | Starter | Pro |
|-----------|-----------|---------|-----|
| **Photo Feedback** | $0 | $0.01 | $0.03 |
| **Price Suggestion** | €0 | €0.05 | €0.20 |
| **Reply Templates** | $0 | $0 | $0 |
| **Ad Optimization** | $0 | $0 | $0 |
| **Auto-Repost (VPS)** | €0.15 | €0.20 | €0.30 |
| **Firebase (read/write)** | $0.02 | $0.03 | $0.05 |
| **KLAZ API (amortized)** | €0 | €0.05 | €0.15 |
| **Storage** | €0.05 | €0.05 | €0.10 |
| **Total per user** | **€0.22** | **€0.38** | **€0.83** |

---

## Part 3: Cost at Scale

### 5 Users
```
Fixed costs:
- VPS (€9)
- KLAZ Starter (€19) — optional, only if Pro users

Variable costs:
- 5 users × €0.30 avg = €1.50

Total: €9 + €0.30 = €9.30/month
Cost per user: €1.86

Revenue @ €4.99 Starter pricing:
- Assume 1 paid user = €4.99
- Net: -€4.31/month (pre-launch, acceptable)
```

### 20 Users
```
Fixed costs: €9 (VPS) + €19 (KLAZ Starter)

Variable:
- 20 users × €0.35 avg = €7

Total: €35/month
Cost per user: €1.75

Revenue @ 30% Starter adoption (6 users @ €4.99):
- €29.94/month — PROFITABLE ✅
```

### 50 Users
```
Fixed: €9 + €19 (KLAZ) = €28

Variable:
- 50 users × €0.40 avg = €20

Total: €48/month
Cost per user: €0.96

Revenue @ 50% Starter (25 users @ €4.99):
- €124.75/month ✅ HIGHLY PROFITABLE
- Gross margin: 74%
```

### 100 Users
```
Fixed: €9 + €19 (KLAZ) = €28

Variable:
- 100 users × €0.45 avg = €45

Total: €73/month
Cost per user: €0.73

Revenue scenarios:
1. Conservative: 40% Starter (40 × €4.99) + 5% Pro (5 × €9.99)
   = €199.60 + €49.95 = €249.55/month
   Gross margin: 70%

2. Optimistic: 50% Starter (50 × €4.99) + 10% Pro (10 × €9.99)
   = €249.50 + €99.90 = €349.40/month
   Gross margin: 79%
```

---

## Part 4: Free Tier Sustainability

**Can you run on Gemini free tier + Firebase free tier indefinitely?**

### Gemini Free Tier Limits
```
- 60 requests per minute
- 1,500 requests per day
- Daily limit: effectively ~30K RPD (requests per day)

Your usage at 100 users:
- Photo analyses: 20–30 requests/day (2–3 per user/month)
- Price suggestions: 5–10 requests/day (1 per user/month)
- Reply templates: 10–15 requests/day (2 per user/month)
- Ad optimization: 5–10 requests/day (1 per user/month)
- Total: ~50 requests/day ✅ WELL UNDER LIMIT
```

### Firebase Free Tier
```
Reads/day: 50,000 (you'll use ~3,000–5,000)
Writes/day: 20,000 (you'll use ~500–1,000)
Storage: 1GB (you'll use ~0.5–1GB for 100 users)
```

**Conclusion:** ✅ Yes, you can run **free-for-all** indefinitely on free tiers until ~200 users.

---

## Part 5: Recommended Pricing Strategy

### Pricing Model (Freemium Subscription)

| Feature | Free | Starter €4.99 | Pro €9.99 |
|---------|------|---------------|-----------|
| **AI Photo Analyses** | 15/month | 500/month | Unlimited |
| **Price Suggestions** | 5 free (KLAZ) | 50/month | Unlimited |
| **Reply Templates** | 3 total | Unlimited | Unlimited |
| **Ad Optimization** | Unlimited | Unlimited | Unlimited |
| **Auto-Repost** | Up to 3 ads | Up to 15 ads | Unlimited |
| **eBay Cross-Post** | — | ✅ Beta | ✅ Full |
| **Priority Support** | — | — | ✅ |
| **Monthly Spend** | €0 | €4.99 | €9.99 |

### Why This Works

1. **Free tier is sustainable** — your marginal cost is ~€0.22 per user
2. **Starter (€4.99) converts high-intent users** — heavy sellers, auto-repost fans
3. **Pro (€9.99) captures power users** — high ad volume, cross-posting
4. **Breakeven at 25 Starter users** — very achievable
5. **Generous free limits** — 15 AI analyses + 3 templates attracts users; paywall feels fair

### Upgrade Triggers (Conversion Levers)

**Hard limits (enforcement):**
```
if (aiAnalysesUsed >= planLimit && planLimit !== Infinity) {
  show: "Analyse-Limit erreicht (15/15) — Upgrade für mehr KI-Analysen"
  button: "Starter ab €4.99/Monat"
}

if (templatesCreated >= freeTemplateLimit && tier === 'free') {
  show: "Du hast 3 Vorlagen erstellt. Unbegrenzte Vorlagen mit Starter!"
  button: "Upgrade"
}

if (autoRepostCount > maxAutoRepostAds[tier]) {
  show: "Du möchtest 4+ Anzeigen automatisch neu einstellen. Das brauchst du Starter!"
  button: "Starter kaufen"
}
```

**Soft nudges (contextual):**
```
On first eBay cross-post attempt:
  "eBay-Verkäufe sind ein Starter-Feature. Testen?"
  Button: "Starter 7 Tage kostenlos" (future referral/trial)

After 10 successful auto-reposts:
  "Du hast 50+ Anfragen durch automatische Wiederauflistungen gewonnen.
   Mit Pro automatisierst du alles + spamst nicht in die Rücklisten."
  Button: "Pro ab €9.99/Monat"

Low credit warning (at 70% of limit):
  "10 von 15 Analysen verbraucht. Upgrade für 500+"
```

---

## Part 6: Recommended Launch Sequence

### Phase 1: MVP (Now — Weeks 1–4)
```
- Pricing: FREE ONLY
- Monetization flag: MONETIZATION_ENABLED=false
- Focus: Validate demand, gather user feedback
- Cost: €9/month VPS
- Conversion target: Get 50 free users
```

### Phase 2: Freemium (Weeks 5–8)
```
- Add Stripe integration
- Enable Starter tier (€4.99)
- Monetization flag: true
- Initial pricing: soft nudges only (hard limits disabled)
- Cost: €9 VPS + €19 KLAZ Starter (if users demand price suggestions)
- Goal: Convert 20–30% to Starter
```

### Phase 3: Premium Tier (Weeks 9–12)
```
- Add Pro tier (€9.99)
- Enforce hard limits on Free tier (15 analyses, 3 templates)
- Add eBay cross-posting (Pro-only, initially)
- Monetization flag: true (hard limits on)
- Goal: Grow to 5–10% Pro adoption
```

### Phase 4: Optimization (Month 4+)
```
- Analyze cohort retention by pricing
- A/B test nudge messaging
- Consider annual billing (10% discount)
- Monitor CAC (customer acquisition cost) vs LTV (lifetime value)
- Target: 10–15% Pro, 30–40% Starter, 50–60% Free
```

---

## Part 7: Financial Projections (12-Month)

### Conservative Scenario (25% Starter, 5% Pro)

```
Month  | Free Users | Starter | Pro | MRR (€) | Costs (€) | Net    |
-------|-----------|---------|-----|---------|-----------|--------|
1      | 50        | 0       | 0   | 0       | 9         | -9     |
2      | 120       | 5       | 0   | 25      | 20        | +5     |
3      | 200       | 15      | 1   | 75      | 30        | +45    |
4      | 300       | 50      | 5   | 300     | 50        | +250   |
5      | 450       | 100     | 15  | 650     | 70        | +580   |
6      | 600       | 175     | 30  | 1,100   | 100       | +1,000 |
...
12     | 1,200     | 400     | 100 | 2,400   | 150       | +2,250 |

Year 1 net revenue: ~€8,000
Breakeven: Month 3
```

### Optimistic Scenario (40% Starter, 10% Pro)

```
Month  | Free Users | Starter | Pro | MRR (€) | Costs (€) | Net    |
-------|-----------|---------|-----|---------|-----------|--------|
6      | 600       | 240     | 60  | 1,600   | 100       | +1,500 |
12     | 1,200     | 600     | 150 | 3,600   | 150       | +3,450 |

Year 1 net revenue: ~€14,000
Cumulative: ~€15,000
```

---

## Part 8: Risk Assessment & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gemini free tier exhausted | High | Implement daily quotas, fall back to free OpenRouter models (no cost increase) |
| Firebase free tier exceeded | Medium | Monitor closely; upgrade to paid only for read/write, not storage (cheapest tier) |
| User churn above 50% MoM | High | Focus on onboarding + value education; track activation metrics |
| KLAZ API becomes paid-only | Medium | Price suggestion is non-core; can disable gracefully or absorb cost (€0.02 per suggestion) |
| Stripe fees (3.2% + €0.30) | Low | Acceptable for B2C SaaS; ~€0.47 per €4.99 payment, €1.20 per €9.99 payment |
| Support overhead | Medium | Document FAQ, use auto-responders, prioritize Pro/Starter support only |

---

## Part 9: Billing Recommendation Summary

### What to Charge For (Revenue Drivers)

1. **Starter Tier (€4.99/month)** — Primary driver for early adopters
   - 500 photo analyses/month (vs 15 free) = clear upgrade value
   - Unlimited reply templates (vs 3 free)
   - Auto-repost up to 15 ads (vs 3 free)
   
2. **Pro Tier (€9.99/month)** — For power users & resellers
   - Unlimited everything
   - eBay cross-posting
   - Priority support
   
3. **Annual Billing** (future)
   - 2 months free (€49.90/year Starter, €99.90/year Pro)
   - Improves retention, easier revenue forecasting

### What to Keep Free (User Acquisition)

1. **Ad optimization** — AI title/description suggestions (text only, cheap)
2. **Reply templates** — Core engagement feature (3 templates, unlimited use)
3. **Basic auto-repost** — 3 ads/month (proves value without limit)
4. **Ad creation UI** — All built-in fields, photo upload, scheduling
5. **Email notifications** — Repost results, performance alerts

### What to Avoid Paywalling

❌ **Don't charge for:**
- Basic analytics (view count, clicks)
- Email support (build FAQ/chat instead)
- Ad search/filtering
- Profile management
- API access (unless B2B)

---

## Conclusion

| Metric | Value |
|--------|-------|
| **Sustainable free tier?** | ✅ Yes, up to 200+ users |
| **Breakeven point** | ~25 Starter users (Month 3–4) |
| **Recommended pricing** | Free / €4.99 Starter / €9.99 Pro |
| **Year 1 projected revenue** | €8,000–15,000 (conservative/optimistic) |
| **Gross margin at 100 users** | 70–80% |
| **Customer acquisition strategy** | Free tier → soft nudges → hard limits at Starter |

**Next steps:**
1. ✅ Launch free-only phase (now)
2. Integrate Stripe + Starter tier (2 weeks)
3. Add Pro tier + hard limits (4 weeks)
4. Monitor cohort economics + optimize messaging
