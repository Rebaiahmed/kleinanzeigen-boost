# Phase 1: Free-Only with Soft Limits (Monitoring Guide)

**Current Configuration:**
```
AI_LIMIT_FREE = 50 (soft limit, no enforcement)
FREE_TEMPLATE_LIMIT = 10 (soft limit, no enforcement)
MONETIZATION_ENABLED = false (no quota blocking)
```

**Duration:** Now through Week 4 (4 weeks)  
**Goal:** Gather real usage data to inform Phase 2 pricing

---

## What This Means

✅ **Users can exceed limits** — nothing is blocked  
✅ **Limits are tracked** — `/api/ai/usage` reports them  
✅ **No upgrade prompts** — users don't see paywalls yet  
✅ **You collect data** — who uses what, how much, how often

→ **Result:** By Week 4, you know actual usage patterns to set Phase 2 limits intelligently

---

## What to Monitor (Weekly)

### 1. Photo Feedback Usage

**Query Firebase:**
```
Collection: aiUsage/{userId}
Field: callsCount (resets monthly)
Field: byModel (which LLM was used)
```

**Track:**
- How many users hit 50+ analyses/month?
- What's the 90th percentile? (This becomes your Phase 2 free limit)
- Who are the heavy users (potential Starter targets)?

**Example data:**
```
Week 1:
  User A: 5 analyses ✓ well under
  User B: 3 analyses ✓ well under
  User C: 18 analyses ← heavy user, note for Phase 2
  User D: 2 analyses ✓
  
Observation: 75% of users < 10/month, 1 power user at 18/month
→ Setting free limit to 15 (Phase 2) will be fair
```

### 2. Reply Template Storage

**Query Firebase:**
```
Collection: replyTemplates
Group by: userId
Count: totalTemplates per user
```

**Track:**
- Who stores more than 3 templates?
- Who stores more than 10 templates?
- What's typical? (1–2? 5–7?)

**Example:**
```
Week 1:
  50% of users: 0–1 templates (don't use feature)
  40% of users: 2–3 templates (light use)
  10% of users: 5–8 templates ← heavy users
  
Observation: 3-template limit might be too tight
→ Test 5 in Phase 1, decide on 3 vs 5 for Phase 2
```

### 3. Price Suggestion Usage

**Query from logs:**
```
GET /api/ai/suggest-price calls per user/day
Count KLAZ API calls in backend logs
```

**Track:**
- How many users use price suggestions?
- Average per user per month?
- Is KLAZ free tier (50 credits + 5/day) enough?

**Example:**
```
Week 1:
  Total API calls: 12 (across 50 users)
  = 0.24 calls per user ← very light
  
Observation: Free tier easily covers all usage
→ Can keep free tier for Phase 2, or paywalk at Week 5
```

### 4. Feature Adoption

**Track in database:**
- % of users who tried photo feedback
- % of users who tried price suggestions
- % of users who created templates
- % of users who enabled auto-repost

**Example dashboard query:**
```sql
SELECT
  (SELECT COUNT(*) FROM aiUsage WHERE callsCount > 0) / (SELECT COUNT(*) FROM users) * 100 AS photo_adoption_pct,
  (SELECT COUNT(*) FROM replyTemplates) / (SELECT COUNT(*) FROM users) AS avg_templates_per_user,
  (SELECT COUNT(*) FROM adSchedules WHERE autoRepostEnabled) / (SELECT COUNT(*) FROM ads) * 100 AS autorepost_adoption_pct
FROM users;
```

---

## Weekly Checklist

**Every Monday:**

- [ ] Export usage stats (photo analyses, templates, price suggestions)
- [ ] Note top 5 users by feature usage
- [ ] Check if anyone hit 50 analyses or 10 templates (note their behavior)
- [ ] Review Firebase costs (should still be on free tier)
- [ ] Check Gemini API logs (are we under quota?)

**Every Friday:**

- [ ] Compile weekly report (see template below)
- [ ] Decide: any limits need adjusting? (e.g., raise free limit if nobody's close)
- [ ] Identify 2–3 power users for potential beta testers of Starter tier

---

## Weekly Report Template

Copy this to a Google Doc or Notion and fill in weekly:

```
PHASE 1 WEEKLY REPORT — Week [N]
────────────────────────────────

📊 USAGE STATS
  Total users: [N]
  Active users (1+ feature used): [N] ([%])
  
📸 PHOTO FEEDBACK
  Total analyses this week: [N] (avg [X] per active user)
  Users hitting 50+/month: [N] ← Watch these
  Max used by one user: [N]
  
📝 REPLY TEMPLATES
  Total templates created: [N]
  Avg per user: [X]
  Users storing 10+: [N] ← May need more than 3-template limit
  
💰 PRICE SUGGESTIONS
  Total API calls: [N]
  Users who tried it: [N]
  KLAZ credits remaining: [N] / 55
  
🎯 OTHER OBSERVATIONS
  - [What surprised you?]
  - [Which feature is most loved?]
  - [Any bottlenecks or bugs?]
  
📈 DECISION NEEDED?
  - Current 50-analysis limit feeling right? Y/N
  - Current 10-template limit feeling right? Y/N
  - Any users we should reach out to for feedback?

NEXT WEEK FOCUS:
  - [ ] Action item 1
  - [ ] Action item 2
```

---

## Key Metrics to Calculate

### Engagement Score (Week N)

```
engagement = (users_with_1+_feature / total_users) * 100

Target: 60%+ by week 4 (2/3 of users tried something)
```

### Feature Stickiness (Week N)

```
stickiness = (users_active_this_week / users_active_last_week) * 100

Target: 70%+ (users come back)
```

### 90th Percentile Usage

```
For photo analyses:
  Sort all users by usage
  Find user at position 90% (e.g., user #45 out of 50)
  Their usage = recommended free limit for Phase 2
  
Example: If 45th user (out of 50) used 18 analyses
  → Set free limit to 15–20 in Phase 2
```

---

## Decision Points (When to Adjust)

### If usage is VERY LOW (<3 analyses/user/month average):
- ✓ Soft limits are fine, keep them
- → Consider raising in Phase 2 (free: 30 instead of 15)
- → Reason: Users aren't hitting limits = no friction = safer to be generous

### If usage is MODERATE (5–15 analyses/user/month):
- ✓ Stick with current limits
- → Phase 2 free limit of 15 is appropriate
- → 80% of users will never see upgrade prompt

### If usage is HIGH (20+ analyses/user/month average):
- ⚠️ Raise Phase 1 limits to 75+ to collect more data
- → Users may self-select into power users (Starter targets)
- → Or: Photo feedback is MORE valuable than expected → raise Pro limit too

### If users are storing 10+ templates:
- ⚠️ 3-template free limit might be too tight
- → Consider: 5 free, unlimited Starter
- → Or: Unlimited free templates (generation is cheap)

---

## Data Collection (SQL Queries)

Run weekly against your backend database:

### Active Users
```sql
SELECT COUNT(DISTINCT userId) as active_users
FROM aiUsage
WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY);
```

### Photo Analysis Distribution
```sql
SELECT 
  callsCount,
  COUNT(userId) as user_count
FROM aiUsage
WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY callsCount
ORDER BY callsCount;
```

### Template Distribution
```sql
SELECT 
  COUNT(*) as total_templates,
  COUNT(DISTINCT userId) as users_with_templates,
  AVG(cnt) as avg_templates_per_user,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY cnt) as p90_templates
FROM (
  SELECT userId, COUNT(*) as cnt
  FROM replyTemplates
  GROUP BY userId
) t;
```

### 90th Percentile Usage
```sql
SELECT 
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY callsCount) as p90_photo_analyses,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY templateCount) as p90_templates
FROM (
  SELECT 
    u.userId,
    COALESCE(a.callsCount, 0) as callsCount,
    COALESCE(t.templateCount, 0) as templateCount
  FROM users u
  LEFT JOIN aiUsage a ON u.userId = a.userId
  LEFT JOIN (SELECT userId, COUNT(*) as templateCount FROM replyTemplates GROUP BY userId) t ON u.userId = t.userId
) usage;
```

---

## Timeline

```
Week 1 (Jun 21–27):
  ✓ Launch with no limits (MONETIZATION_ENABLED=false)
  ✓ Collect baseline usage (first week always skewed)
  ✓ Monitor Gemini quota usage

Week 2 (Jun 28–Jul 4):
  ✓ Compile first report
  ✓ Identify power users
  ✓ Assess if limits need raising (e.g., if someone hits 50 already)

Week 3 (Jul 5–11):
  ✓ Full week of realistic usage data
  ✓ Run 90th percentile calculations
  ✓ Decide: Are current soft limits (50/10) reasonable?

Week 4 (Jul 12–18):
  ✓ Final week of data collection
  ✓ Make decisions for Phase 2
  ✓ Plan Stripe integration (Week 5)
```

---

## Phase 1 → Phase 2 Transition (Week 5)

**Before flipping to Phase 2, confirm:**

- [ ] 50+ beta users collected 4 weeks of usage data
- [ ] 90th percentile usage calculated (informs free limits)
- [ ] You identified 5–10 power users (potential early Starter customers)
- [ ] Stripe account ready
- [ ] Pricing page prepared
- [ ] Soft nudge messages written (in German)

**Then:**

1. Email beta users: "Phase 2 starts Monday! Upgrade to Starter for €4.99, or keep free tier at 15 analyses/month."
2. Deploy with:
   ```
   AI_LIMIT_FREE = 15 (or your calculated value)
   FREE_TEMPLATE_LIMIT = 3 (or your calculated value)
   MONETIZATION_ENABLED = true (enforce soft nudges)
   ```
3. Soft nudges appear: "You've used 12/15 analyses. Learn more about Starter"
4. Monitor conversion

---

## Red Flags to Watch

⚠️ **If Gemini free tier is exhausted:**
- You'll see 429 (quota exceeded) errors in logs
- Fallback to OpenRouter free models (Gemma, Llama) — no cost increase
- If you hit OpenRouter limits too, only then you pay

⚠️ **If users hit limits and get frustrated:**
- Soft limit is too tight
- Raise it (e.g., 50 → 75 analyses)
- Users should rarely see limits in Phase 1

⚠️ **If nobody uses a feature:**
- Photo feedback might not be clear what it does → improve UX
- Templates might lack use-case examples → add samples
- Price suggestions might be buggy → check logs

⚠️ **If you don't reach 50 users by Week 3:**
- Adjust marketing (social media, product forums, eBay communities)
- Ask beta users to refer friends
- Improve onboarding tutorial

---

## Success Criteria for Phase 1

By end of Week 4:

✅ **50+ users**  
✅ **60%+ tried 1+ AI feature**  
✅ **70%+ retention week-to-week**  
✅ **90th percentile usage calculated**  
✅ **5+ "power users" identified**  
✅ **Gemini free tier still available** (not exhausted)

If yes → Ready for Phase 2 (Starter tier launch)  
If no → Debug, improve, extend Phase 1

---

## Questions to Answer by Week 4

1. **Who are your power users?** (20%+ of limit usage)
   → Target them for Starter tier at launch

2. **Which feature drives engagement?** (Photo, templates, price, optimization?)
   → Emphasize in Phase 2 marketing

3. **What's the dropout point?** (Do users churn after trying 1 feature? Or after 2 weeks?)
   → Improve onboarding if needed

4. **Is the free tier generous enough?** (Are users hitting limits, or complaining they're too restrictive?)
   → Adjust Phase 2 free limits accordingly

5. **Are there bugs or UX issues?** (Stack traces in logs?)
   → Fix before monetization (hard to convert if feature is broken)

---

**Report Status:** Ready to track during Phase 1  
**Next Review:** End of Week 4 (before Phase 2 launch)
