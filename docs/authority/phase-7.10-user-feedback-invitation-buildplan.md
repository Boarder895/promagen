# Phase 7.10 — User Feedback Invitation: Build Plan

**Date:** 2026-02-28
**Phase:** 7.10 — The Missing Signal
**Authority:** `prompt-builder-evolution-plan-v2.md` § 7.10
**Estimated effort:** 8 parts across ~3 days

---

## The Problem

We have 17 layers of learning intelligence, all powered by **inferred** signals — did they copy? Did they come back within 60 seconds? Did they save it? These are proxy signals. We're reading body language instead of asking the question.

The evolution plan says it best:

> _"The biggest gap: we never ask. We infer quality from proxies. A direct signal is 10× more valuable."_

Phase 7.10 closes this gap. One click. Three options. Massive signal quality improvement.

---

## Existing Infrastructure (What We're Building On)

| Component                   | File                                         | What It Does                                                            | How 7.10 Uses It                                                                 |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Outcome Score Engine**    | `outcome-score.ts` (530 lines)               | Computes 0–1 outcome from copied/saved/reused/returned signals          | Feedback becomes a **5th outcome signal** — the strongest one                    |
| **Confidence Multiplier**   | `outcome-score.ts` §7.1                      | Weights signals by user tier, account age, session depth, final-attempt | Feedback gets its own **Credibility Score** that feeds into this system          |
| **Prompt Telemetry Client** | `prompt-telemetry-client.ts` (322 lines)     | Fires events on copy/save, tracks sessions, return-within-60s           | Feedback submission reuses the same session tracking + event ID linkage          |
| **Prompt Events Table**     | `database.ts` — `prompt_events`              | Stores all telemetry with `outcome` JSONB column                        | Feedback rating gets written into the `outcome` JSONB alongside existing signals |
| **Auth Hook**               | `use-promagen-auth.ts`                       | Provides `userTier`, `accountAgeDays`, `isSignedIn`, `promptLockState`  | Supplies all credibility factors client-side                                     |
| **Daily Usage Hook**        | `use-daily-usage.ts`                         | Tracks copy count per day/session                                       | Provides frequency signal for credibility scoring                                |
| **Copy Flow**               | `prompt-builder.tsx` line 1128               | `handleCopyPrompt()` → clipboard + telemetry fire                       | Feedback widget appears **after** this flow completes                            |
| **Toast System**            | `toast-copy-feedback.tsx` (34 lines)         | Basic "Prompt copied for {provider}" toast                              | Gets replaced/enhanced with feedback-inviting toast                              |
| **Learning Constants**      | `constants.ts` (105 constants)               | Central config for all learning thresholds                              | New feedback constants slot in here                                              |
| **Aggregate Cron**          | `aggregate/route.ts` (1565 lines, 17 layers) | Nightly learning pipeline                                               | Layer 18 processes feedback signals                                              |

---

## Architecture Overview

```
User copies prompt
        │
        ▼
  ┌─────────────────────────┐
  │  "Copied!" toast (2s)   │
  │  ✓ existing behaviour   │
  └────────────┬────────────┘
               │ 4 seconds later
               ▼
  ┌─────────────────────────────────────┐
  │  FEEDBACK INVITATION WIDGET         │
  │                                     │
  │  "How did this prompt perform?"     │
  │                                     │
  │  👍 Nailed it   👌 Just okay   👎 Missed │
  │                                     │
  │  ── or on next visit ──             │
  │  Subtle return banner:              │
  │  "Your last prompt for Midjourney?" │
  │  👍  👌  👎                          │
  └────────────┬────────────────────────┘
               │ single click
               ▼
  ┌─────────────────────────────────────────────────┐
  │  CREDIBILITY ENGINE (client-side computation)    │
  │                                                  │
  │  Base weight: 1.0                                │
  │  × Tier factor    (paid: 1.25, free: 1.0,       │
  │                     anon: 0.60)                  │
  │  × Age factor     (veteran 90d+: 1.15,          │
  │                     experienced 30d+: 1.10,      │
  │                     settling 7d+: 1.0,           │
  │                     new <7d: 0.85)               │
  │  × Frequency factor (daily: 1.15,               │
  │                       weekly: 1.05,              │
  │                       casual: 1.0,               │
  │                       rare: 0.90)                │
  │  × Response speed   (< 2min: 1.10,              │
  │                       < 1hr: 1.0,                │
  │                       < 24hr: 0.95,              │
  │                       > 24hr: 0.85)              │
  │  = credibility score (clamped 0.40–1.80)         │
  └────────────┬────────────────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │  POST /api/feedback                   │
  │  { eventId, rating, credibility,      │
  │    responseTimeMs, platform, tier }   │
  └────────────┬─────────────────────────┘
               │
               ▼
  ┌──────────────────────────────────────┐
  │  feedback_events table (Neon PG)      │
  │  + UPDATE prompt_events.outcome       │
  │    SET feedbackRating = rating,       │
  │        feedbackCredibility = score    │
  └────────────┬─────────────────────────┘
               │ nightly cron
               ▼
  ┌──────────────────────────────────────┐
  │  Layer 18: Feedback Aggregation       │
  │  → Weighted satisfaction per term     │
  │  → Per-platform satisfaction curves   │
  │  → Streak detection (3+ 👎 = alert)  │
  │  → stored in learned_weights          │
  └──────────────────────────────────────┘
```

---

## Credibility Score: The Heart of This System

This is your key insight, Martin. Not all feedback is equal. A paying veteran who uses the platform daily and rates within 30 seconds of copying — that person _tested the prompt in their AI tool and came back to tell you_. That signal is gold.

A brand-new anonymous user who rates 2 days later? Still useful, but lower confidence.

### Credibility Factor Matrix

| Factor              | Level                                | Multiplier | Rationale                                                      |
| ------------------- | ------------------------------------ | ---------- | -------------------------------------------------------------- |
| **User Tier**       | Paid (Pro Promagen)                  | **1.25**   | Financially invested, deliberate users, most valuable feedback |
|                     | Signed in (free)                     | **1.00**   | Baseline — accountable, trackable                              |
|                     | Anonymous                            | **0.60**   | No accountability, might be random clicking                    |
| **Account Age**     | Veteran (90+ days)                   | **1.15**   | Knows what works, developed taste across platforms             |
|                     | Experienced (30–89 days)             | **1.10**   | Familiar with the tool, reliable judgment                      |
|                     | Settling (7–29 days)                 | **1.00**   | Baseline — learning the platform                               |
|                     | New (0–6 days)                       | **0.85**   | Still exploring, may not know what good output looks like      |
| **Usage Frequency** | Daily (5+ copies this week)          | **1.15**   | Power user — tests prompts constantly, knows quality           |
|                     | Weekly (2–4 copies this week)        | **1.05**   | Regular user, reliable                                         |
|                     | Casual (1 copy this week)            | **1.00**   | Baseline                                                       |
|                     | Rare (0 copies this week, returning) | **0.90**   | May have forgotten context                                     |
| **Response Speed**  | Instant (< 2 min after copy)         | **1.10**   | Just tested it — freshest signal                               |
|                     | Quick (< 1 hour)                     | **1.00**   | Baseline — reasonable feedback window                          |
|                     | Delayed (< 24 hours)                 | **0.95**   | Might be rating from memory                                    |
|                     | Late (> 24 hours)                    | **0.85**   | Memory decay — less reliable                                   |

### Example Credibility Calculations

**Best case:** Paid veteran, daily user, rates within 30 seconds

```
1.25 × 1.15 × 1.15 × 1.10 = 1.818 → clamped to 1.80
```

**Baseline:** Free signed-in user, settling, weekly, rates in 20 minutes

```
1.00 × 1.00 × 1.05 × 1.00 = 1.05
```

**Lowest case:** Anonymous, new, rare, rates next day

```
0.60 × 0.85 × 0.90 × 0.85 = 0.39 → clamped to 0.40
```

The range is **0.40–1.80** — wide enough to meaningfully distinguish signal quality, narrow enough that no single user dominates and nobody's voice is crushed.

---

## Rating Scale Design

The evolution plan spec says three buttons with explanatory text. Here's the design:

```
┌──────────────────────────────────────────────────────┐
│  How did this prompt perform?                        │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │   👍     │  │   👌     │  │   👎     │           │
│  │ Nailed it│  │ Just okay│  │  Missed  │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                      │
│  Rate how the AI image matched your vision.          │
│                                                      │
│  ╳ dismiss                                           │
└──────────────────────────────────────────────────────┘
```

| Rating   | Emoji | Label       | Numeric Value | Meaning                                     |
| -------- | ----- | ----------- | ------------- | ------------------------------------------- |
| Positive | 👍    | "Nailed it" | `1.0`         | AI output matched or exceeded expectations  |
| Neutral  | 👌    | "Just okay" | `0.5`         | Usable but not impressive — mediocre result |
| Negative | 👎    | "Missed"    | `0.0`         | AI output didn't match the vision at all    |

Critical design note: **👌 means mediocre, not approval.** The label "Just okay" and the subtitle "Rate how the AI image matched your vision" make this unambiguous. Without this framing, users read 👌 as positive.

---

## Build Parts

### Part 7.10a — Data Layer: Feedback Types + Database Schema

**Files:**

- `src/types/feedback.ts` — **NEW** ~120 lines
- `src/lib/learning/database.ts` — MODIFIED (add `feedback_events` table + migration)
- `src/lib/learning/constants.ts` — MODIFIED (add feedback constants block)

**What gets built:**

1. **`FeedbackRating` type** — `'positive' | 'neutral' | 'negative'` with numeric mapping
2. **`FeedbackCredibilityInput` interface** — userTier, accountAgeDays, weeklyUsageCount, responseTimeMs
3. **`FeedbackCredibilityBreakdown` interface** — per-factor breakdown for admin dashboard
4. **`FeedbackEvent` interface** — complete event shape (eventId, promptEventId, rating, credibility, metadata)
5. **`computeFeedbackCredibility()` pure function** — the 4-factor computation from the matrix above
6. **`computeFeedbackCredibilityDetailed()` function** — with full breakdown (mirrors outcome-score pattern)
7. **`feedback_events` table** — `id, prompt_event_id, rating, credibility_score, credibility_factors, response_time_ms, user_tier, account_age_days, platform, tier, created_at`
8. **Index** on `prompt_event_id` for JOIN back to prompt_events
9. **Index** on `created_at` for nightly cron time-range queries
10. **Migration** in `ensureAllTables()` — `ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS feedback_rating TEXT` + `ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS feedback_credibility REAL`
11. **Constants block** — `FEEDBACK_CREDIBILITY_*` constants for all thresholds and multipliers

**Why dedicated table + denormalized columns:**

- `feedback_events` table stores the full event for admin drill-down and audit
- `prompt_events.feedback_rating` + `feedback_credibility` columns enable efficient JOIN-free queries in the 17 existing cron layers that already read `prompt_events`

---

### Part 7.10b — API Route: Feedback Submission Endpoint

**Files:**

- `src/app/api/feedback/route.ts` — **NEW** ~180 lines

**What gets built:**

1. **POST `/api/feedback`** — Zod-validated endpoint
2. **Schema:** `{ promptEventId: string, rating: 'positive'|'neutral'|'negative', credibilityScore: number, credibilityFactors: object, responseTimeMs: number, platform: string, tier: 1|2|3|4 }`
3. **Rate limiting** — 5 feedback/min per IP (generous but prevents spam)
4. **Idempotency** — `ON CONFLICT (prompt_event_id) DO NOTHING` — one feedback per prompt event, first one wins
5. **Dual write:** INSERT into `feedback_events` + UPDATE `prompt_events` SET `feedback_rating`, `feedback_credibility`
6. **Safe mode** support — accepts but doesn't persist (mirrors telemetry route pattern)
7. **GDPR safe** — no user IDs stored, same anonymous model as telemetry

---

### Part 7.10c — Client: Feedback Widget Component

**Files:**

- `src/components/ux/feedback-invitation.tsx` — **NEW** ~280 lines
- `src/lib/feedback/feedback-client.ts` — **NEW** ~150 lines

**What gets built:**

1. **`FeedbackInvitation` component** — The 👍👌👎 widget
   - Three large tap-target buttons with emoji + label
   - Subtitle text: "Rate how the AI image matched your vision"
   - Dismiss button (╳) that records dismissal in sessionStorage
   - Success animation on click: button scales + checkmark + "Thanks!" text
   - Auto-dismiss 1.5s after rating
   - All sizes use `clamp()` fluid typography
   - Smooth slide-in animation from bottom

2. **Two trigger modes:**
   - **Post-copy timer:** Appears 4 seconds after successful copy (not 60s — that's too long, user may have left). The 4s delay lets the "Copied!" confirmation clear, then catches them while they're still looking at the screen.
   - **Return visit banner:** If there's an unrated prompt from last session, show a compact inline banner at the top of the prompt builder on next visit. "Your last prompt for Midjourney — how did it go?" with the same 3 buttons.

3. **`sendFeedback()` client function** — fire-and-forget POST to `/api/feedback`
   - Computes credibility score client-side (pure function, same as server validation)
   - Calculates `responseTimeMs` from copy timestamp (stored in sessionStorage)
   - Reads `userTier`, `accountAgeDays` from auth hook props
   - Reads weekly usage count from daily usage hook
   - Links to original `promptEventId` (stored in sessionStorage at copy time)

4. **sessionStorage tracking:**
   - `promagen_feedback_pending` — `{ eventId, platform, tier, copiedAt }` — set on copy, cleared on rate/dismiss
   - `promagen_feedback_dismissed` — timestamp — prevents re-showing for 24h after dismiss
   - `promagen_feedback_weeklyCount` — rolling 7-day copy count for frequency factor

---

### Part 7.10d — Integration: Wire Widget into Prompt Builder

**Files:**

- `src/components/providers/prompt-builder.tsx` — MODIFIED (~30 lines added)

**What gets built:**

1. **State:** `feedbackPending` — tracks whether widget should show
2. **Copy handler extension:** After successful copy, store pending feedback metadata in sessionStorage and set a 4s timer to show the widget
3. **Render:** `<FeedbackInvitation>` placed between the footer and the `<SavePromptModal>`, conditionally rendered when `feedbackPending` is true
4. **Props threading:** Pass `userTier`, `accountAgeDays`, `platformId`, `platformTier`, weekly usage count
5. **Return visit detection:** On mount, check sessionStorage for unrated prompt → show compact inline banner
6. **Callback:** `onFeedbackSubmitted` clears pending state + fires optional analytics event

---

### Part 7.10e — Outcome Score Integration: Feedback as 5th Signal

**Files:**

- `src/lib/learning/outcome-score.ts` — MODIFIED (~40 lines)
- `src/types/prompt-telemetry.ts` — MODIFIED (~10 lines)

**What gets built:**

1. **New signal weight:** `OUTCOME_SIGNAL_WEIGHTS.feedbackPositive = 0.40` (strongest positive signal after reuse)
2. **New signal weight:** `OUTCOME_SIGNAL_WEIGHTS.feedbackNeutral = 0.0` (neutral = no change)
3. **New signal weight:** `OUTCOME_SIGNAL_WEIGHTS.feedbackNegative = -0.30` (strong negative signal)
4. **Credibility-weighted feedback:** The feedback signal is multiplied by `feedbackCredibility` before adding to outcome score:
   ```
   feedbackContribution = signalWeight × credibilityScore
   ```
   A 👍 from a paid veteran (cred 1.80): +0.72
   A 👍 from an anon new user (cred 0.40): +0.16
5. **OutcomeSignals interface extension:** `feedbackRating?: 'positive'|'neutral'|'negative'`, `feedbackCredibility?: number`
6. **PromptOutcome interface extension:** Same fields
7. **Backward compatible:** Missing fields default to no-op (exactly like Phase 7.1/7.2 extensions)

---

### Part 7.10f — Extra Feature #1: Feedback Sentiment Streaks

**Files:**

- `src/lib/learning/feedback-streaks.ts` — **NEW** ~200 lines
- `src/lib/learning/constants.ts` — MODIFIED (streak constants)

**What gets built:**

Track consecutive feedback patterns per user session and per platform. When patterns emerge, the system takes action.

**Streak types:**

| Streak             | Condition                          | Action                                                                                                                                              |
| ------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔥 **Hot streak**  | 3+ consecutive 👍 on same platform | Boost weight of the term combinations used in those prompts. The user has found a winning formula — amplify it in the learning data.                |
| ❄️ **Cold streak** | 3+ consecutive 👎 on same platform | Flag for admin review. Something systematic is failing — possibly a platform API change, a bad term interaction, or a stale provider configuration. |
| 🔄 **Oscillating** | Alternating 👍👎👍👎 (4+ ratings)  | Suggests inconsistent platform behaviour. Record as "high variance" — useful for A/B testing decisions.                                             |

**Implementation:**

- `FeedbackStreakTracker` class — maintains per-session streak state
- `detectStreak(history: FeedbackRating[])` → `StreakSignal | null`
- `computeStreakBoost(streak: StreakSignal)` → multiplier for term combination weights
- Hot streak boosts: The specific `selections` from those prompts get a 1.15× quality score boost in the next cron run
- Cold streak alerts: Stored in `learned_weights` under key `'feedback-alerts'` for admin dashboard consumption
- Streak data stored in sessionStorage client-side, flushed to server as part of feedback event metadata

**Why this matters:** Streaks create a **real-time learning loop**. Instead of waiting for the nightly cron to discover that Midjourney users hate a certain term combination, you know within 3 prompts. That's the difference between losing 100 users and losing 3.

---

### Part 7.10g — Extra Feature #2: Contextual Feedback Memory

**Files:**

- `src/hooks/use-feedback-memory.ts` — **NEW** ~120 lines
- `src/components/ux/feedback-memory-banner.tsx` — **NEW** ~100 lines

**What gets built:**

Remember the user's feedback history and surface it contextually. This creates a dopamine loop that encourages more feedback.

**How it works:**

1. **localStorage persistence:** Store last 10 feedback events per platform: `{ platform, rating, termSummary, timestamp }`
2. **Pattern detection:** When the user starts building a new prompt for the same platform, check if their current selections overlap with previously-rated prompts
3. **Contextual banner:** If overlap detected, show a micro-summary:
   - After 👍: `"Your last Midjourney prompt with 'cinematic lighting + bokeh' scored 👍 — similar setup detected"`
   - After 👎: `"Heads up: your last prompt with 'watercolor + hyperrealistic' missed on DALL·E 3 — consider alternatives"`
4. **Smart suggestion:** After a 👎, highlight the specific terms that appeared in the negative-rated prompt with a subtle amber indicator (reuses the expendability chip border pattern from Phase 7.9d)
5. **Encouragement:** After submitting feedback, show a warmth message: `"Thanks! Your feedback helps Promagen learn."` — for paid users: `"Pro feedback — weighted 1.25× in our learning engine."`

**Why this matters:** The #1 reason users don't give feedback is they don't see the point. By showing them _their feedback is remembered and used_, you create a virtuous cycle. The warmth message for paid users reinforces the value of their subscription — they see their feedback literally counts more.

---

### Part 7.10h — Extra Feature #3: Admin Feedback Pulse Dashboard

**Files:**

- `src/components/admin/feedback-pulse-dashboard.tsx` — **NEW** ~350 lines
- `src/app/api/learning/feedback-summary/route.ts` — **NEW** ~120 lines
- `src/app/admin/page.tsx` — MODIFIED (mount widget)

**What gets built:**

Real-time admin visibility into feedback health. A pipeline health widget on the admin dashboard (same pattern as CompressionDashboard and TemporalFreshnessBadge).

**Dashboard sections:**

1. **Feedback Velocity** — Total feedback events: today / this week / all time. Sparkline showing daily feedback volume trend. Target: 10% of copies should generate feedback (industry benchmark for optional rating systems is 3–8%, we aim higher because the widget is well-designed).

2. **Sentiment Distribution** — Pie or bar showing 👍 / 👌 / 👎 split. Credibility-weighted vs raw counts side by side. "If paid users love it but free users don't, the weighted score will reveal that."

3. **Credibility-Weighted Satisfaction Score** — Single number 0–100 representing platform health. Formula: `Σ(rating × credibility) / Σ(credibility) × 100`. Green (75+), amber (50–74), red (<50). Separate scores per platform and per tier.

4. **Red Flag Detector** — Alerts for:
   - Any platform with satisfaction < 50 in the last 48 hours
   - Any term appearing in 3+ negative feedback events in 24 hours
   - Cold streaks (3+ consecutive 👎) from high-credibility users
   - Feedback velocity dropping >50% week-over-week (users stopped rating = bad sign)

5. **Recent Feedback Stream** — Last 20 feedback events with credibility badge, platform, rating, and time. Click to expand shows the actual prompt text and selections. Colour-coded by rating.

**API route:** `/api/learning/feedback-summary` — aggregates feedback_events table with time-windowed queries, returns summary JSON. 5-minute cache.

---

## Layer 18: Nightly Cron Integration

Added to `aggregate/route.ts` as Layer 18 (runs in parallel with Layers 14a/14b/16/17).

**What Layer 18 computes:**

1. **Per-term feedback scores:** For each vocabulary term, compute credibility-weighted average satisfaction from all feedback events where that term was in the selections. Terms with high negative feedback become candidates for weak-term flagging.

2. **Per-platform satisfaction curves:** Rolling 7-day satisfaction score per platform. Detect downward trends (platform API change?) and trigger admin alerts.

3. **Streak aggregation:** Process streak data, boost hot-streak term combinations in quality scores, file cold-streak alerts.

4. **Feedback-outcome correlation:** Compare inferred outcome scores (from copy/save/return signals) with direct feedback ratings. If they diverge, the inference model needs recalibration. This is the self-improving scorer's ultimate validation signal.

**Output:** Stored in `learned_weights` table under key `'feedback-aggregation'`.

---

## File Impact Map

| File                                                | Action                  | Lines Changed | Part  |
| --------------------------------------------------- | ----------------------- | ------------- | ----- |
| `src/types/feedback.ts`                             | **NEW**                 | ~120          | 7.10a |
| `src/lib/learning/database.ts`                      | MODIFIED                | +40           | 7.10a |
| `src/lib/learning/constants.ts`                     | MODIFIED                | +35           | 7.10a |
| `src/app/api/feedback/route.ts`                     | **NEW**                 | ~180          | 7.10b |
| `src/components/ux/feedback-invitation.tsx`         | **NEW**                 | ~280          | 7.10c |
| `src/lib/feedback/feedback-client.ts`               | **NEW**                 | ~150          | 7.10c |
| `src/components/providers/prompt-builder.tsx`       | MODIFIED                | +30           | 7.10d |
| `src/lib/learning/outcome-score.ts`                 | MODIFIED                | +40           | 7.10e |
| `src/types/prompt-telemetry.ts`                     | MODIFIED                | +10           | 7.10e |
| `src/lib/learning/feedback-streaks.ts`              | **NEW**                 | ~200          | 7.10f |
| `src/hooks/use-feedback-memory.ts`                  | **NEW**                 | ~120          | 7.10g |
| `src/components/ux/feedback-memory-banner.tsx`      | **NEW**                 | ~100          | 7.10g |
| `src/components/admin/feedback-pulse-dashboard.tsx` | **NEW**                 | ~350          | 7.10h |
| `src/app/api/learning/feedback-summary/route.ts`    | **NEW**                 | ~120          | 7.10h |
| `src/app/admin/page.tsx`                            | MODIFIED                | +5            | 7.10h |
| `src/app/api/learning/aggregate/route.ts`           | MODIFIED                | +80           | 7.10h |
| **TOTAL**                                           | **10 NEW + 6 MODIFIED** | **~1,860**    |       |

---

## Build Order & Dependencies

```
7.10a  Data Layer (types + DB + constants)
  │
  ├─► 7.10b  API Route (needs types + DB)
  │     │
  │     ├─► 7.10c  Widget Component (needs API + types)
  │     │     │
  │     │     └─► 7.10d  Prompt Builder Integration (needs widget)
  │     │
  │     └─► 7.10e  Outcome Score Integration (needs types)
  │
  ├─► 7.10f  Streak Detection (needs types + constants)
  │
  ├─► 7.10g  Feedback Memory (needs types)
  │
  └─► 7.10h  Admin Dashboard (needs API + types + DB)
```

Parts f, g, h are independent of each other and of d/e. The critical path is **a → b → c → d**.

---

## My Addition: Response Speed as a Credibility Signal

This is the 4th factor in the credibility matrix that I added to your three. Here's why:

When someone copies a prompt, pastes it into Midjourney, waits 60 seconds for generation, looks at the result, and comes back to rate it — that entire round-trip takes about 2 minutes. If someone rates within 2 minutes, they almost certainly tested the prompt. That's the freshest, most reliable signal possible.

Someone who rates 24 hours later is rating from memory. Still useful, but the signal has decayed. This temporal dimension is unique to feedback — none of the existing outcome signals (copy, save, return) have it.

The implementation is zero-cost: we already store `copiedAt` timestamp in sessionStorage (from the telemetry client). `responseTimeMs = Date.now() - copiedAt` is computed at feedback submission time.

---

## Success Metrics

| Metric                  | Target                                        | Measurement                                                            |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| **Feedback rate**       | 10% of copies generate feedback               | `COUNT(feedback) / COUNT(copies)` per week                             |
| **Rating distribution** | 60/25/15 (👍/👌/👎)                           | Healthy platform = mostly positive with meaningful neutral/negative    |
| **Credibility spread**  | Mean credibility > 1.0                        | Proves paid/veteran users are giving more feedback (which they should) |
| **Outcome correlation** | r > 0.6 between inferred outcome and feedback | Validates that our proxy signals are actually measuring quality        |
| **Streak detection**    | < 24hr from cold streak to admin alert        | Measures how fast the system flags problems                            |
| **Admin response time** | Admin sees red flag within 1 dashboard visit  | Feedback Pulse dashboard surfaces issues without requiring drill-down  |

---

## Risk Register

| Risk                                                                | Likelihood | Impact | Mitigation                                                                                                                                                                           |
| ------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Rating fatigue** — users stop rating after novelty wears off      | Medium     | High   | Contextual Memory (7.10g) creates dopamine loop. Only show widget on first copy per session, not every copy.                                                                         |
| **Positivity bias** — users only rate when happy                    | Medium     | Medium | The "return visit" banner catches users who had bad results but didn't bother rating in the moment. Neutral option reduces social desirability bias.                                 |
| **Credibility gaming** — paid user spams 👍                         | Low        | Low    | Idempotency (one rating per event). Session-level streak detection catches anomalous patterns. Max 5 ratings/min rate limit.                                                         |
| **Anonymous spam**                                                  | Low        | Medium | Anonymous credibility is already 0.60×. Rate limiting (5/min per IP). Minimum quality gates on the original prompt still apply.                                                      |
| **Feedback ≠ prompt quality** — user blames prompt for bad AI model | Medium     | Medium | Subtitle text says "Rate how the AI image matched your vision" — frames it as match quality, not absolute quality. Per-platform satisfaction curves detect platform-specific issues. |

---

## What This Unlocks

Once Phase 7.10 ships, the learning pipeline has **both sides of the signal equation:**

- **Inferred signals** (Phases 5–7.9): What did the user _do_? (copy, save, return, reuse)
- **Direct signals** (Phase 7.10): What did the user _think_?

This enables:

- **True scorer validation:** Comparing inferred outcome scores with direct feedback reveals whether the scoring model actually predicts user satisfaction
- **Term-level quality truth:** Instead of inferring "cinematic lighting is good because it appears in saved prompts," we can measure "cinematic lighting is good because users who include it rate 👍 73% of the time"
- **Platform health monitoring:** Real-time detection of platform degradation (API changes, model updates) through feedback velocity and sentiment shifts
- **A/B test turbocharging:** The A/B testing pipeline (Phase 7.6) currently measures inferred outcomes. Adding direct feedback as an A/B metric is a one-line change that dramatically improves test sensitivity

Phase 7.10 turns Promagen from a system that _guesses_ what users want into a system that _knows_.
