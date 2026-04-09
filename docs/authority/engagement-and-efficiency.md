# Engagement Pipeline & API Efficiency

**Last updated:** 9 April 2026
**Version:** 1.0.0 (merged from 2 source docs)
**Owner:** Promagen
**Status:** Production
**Merged from:** `the-like-system.md` v2.0.0 + `api-calming-efficiency.md`

---

# Part 1 — The Like System (Feedback Pipeline)


**Last updated:** 7 March 2026
**Version:** 2.0.0
**Owner:** Promagen
**Status:** Implemented
**Authority:** This document is the single source of truth for all user feedback collection across Promagen. Every surface that collects a like, dislike, or neutral signal must use this system. No exceptions.

---

## 1. Principle

Feedback is gold. Every user interaction that signals quality — good, okay, or bad — feeds directly into the learning pipeline that makes Promagen's prompts and scoring more intelligent every day. One system, one endpoint, one table, one pipeline. No isolated like systems, no orphaned vote tables, no signals that go nowhere.

---

## 2. The Three-Point Rating Scale

Every feedback surface in Promagen uses the same three-point scale:

| Emoji | Rating     | Internal Value | Colour             | Meaning                                             |
| ----- | ---------- | -------------- | ------------------ | --------------------------------------------------- |
| 👍    | `positive` | 1.0            | Emerald `#34D399`  | Nailed it — prompt matched or exceeded expectations |
| 👌    | `neutral`  | 0.5            | Amber `#FBBF24`    | Just okay — mediocre, not impressive                |
| 👎    | `negative` | 0.0            | Soft red `#F87171` | Missed — prompt did not work                        |

**Design constraint:** 👌 means "mediocre, not impressive" — NOT approval. The distinction between "good" and "just okay" is the most valuable signal for calibrating prompt quality.

**Exception:** The Image Quality vote in the leaderboard uses 👍 only. You don't thumbs-down a provider's image quality — you just don't vote. This single-signal vote still writes to the unified pipeline as `rating: 'positive'`.

---

## 3. Where Feedback Appears

| Surface                          | UI                              | itemId Format                                                                               | Source Tag           | Replaces           |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- | -------------------- | ------------------ |
| PotM showcase (homepage centre)  | 👍👌👎 inline + coloured counts | `potm:{rotationIndex}:tier{N}` (deterministic, links to real `prompt_events` row via Gap 2) | `showcase`           | ♡ heart (deleted)  |
| Community Pulse (homepage right) | 👍👌👎 inline + coloured counts | `pulse:{entryId}`                                                                           | `pulse`              | ♡ heart (deleted)  |
| Prompt builder (after copy)      | 👍👌👎 overlay (4s delay)       | `{promptEventId}` from telemetry                                                            | `builder`            | Unchanged          |
| Image Quality (leaderboard)      | 👍 only (existing thumb SVG)    | `iq:{providerId}`                                                                           | `image-quality-vote` | Dual-write (added) |

**Rule:** Any future surface that collects user quality signals must use this system. No new like tables, no new vote endpoints, no isolated signals.

---

## 4. Architecture

### 4.1 Data Flow

```
User interaction anywhere on Promagen
        │
        ▼
  FeedbackWidget (👍 👌 👎)  or  Image Quality vote (👍 only)
        │
        ▼
  sendFeedbackDirect() or sendFeedback()
        │
        ▼
  POST /api/feedback
        │
        ▼
  feedback_events table (Neon PostgreSQL)
        │
        ├──→ Credibility scoring (4-factor)
        ├──→ Streak detection (hot/cold/oscillating)
        ├──→ Term-level feedback memory
        ├──→ Scene enhancer personalisation
        ├──→ Admin dashboard (Section 10)
        ├──→ Nightly cron aggregation (17-layer pipeline)
        │
        ├──→ [Gap 1] prompt_events.feedback_rating/feedback_credibility
        │    → outcomeWithFeedback() merges into outcome score
        │    → All 5 engines: term-quality, weight-recalibration,
        │      magic-combos, anti-patterns, category-value-discovery
        │
        ├──→ [Gap 2] PotM showcase fires sendShowcaseTelemetry()
        │    → Creates real prompt_events row with deterministic ID
        │    → FeedbackWidget links feedback to real term selections
        │    → Learning pipeline traces 👎 → specific terms penalised
        │
        └──→ [Gap 3] category-value-discovery computes feedbackSentiment
             → Per-category: (positive - negative) / total
             → Reveals which vocabulary categories need diversification
```

### 4.2 Two Client Functions

| Function               | Used By                            | Requires sessionStorage?          | Credibility Scoring                                  |
| ---------------------- | ---------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `sendFeedback()`       | Prompt builder (post-copy)         | Yes — needs `FeedbackPendingData` | Full 4-factor (tier, age, frequency, speed)          |
| `sendFeedbackDirect()` | FeedbackWidget, Image Quality vote | No — accepts params directly      | Default 1.0 (inline widgets have no account context) |

Both functions POST to the same `/api/feedback` endpoint. Both write to the same `feedback_events` table. The only difference is how they gather their parameters.

---

## 5. FeedbackWidget Component

**File:** `src/components/ux/feedback-widget.tsx`

Compact inline 👍👌👎 widget designed to drop into any surface.

### 5.1 Props

| Prop            | Type             | Required | Description                                                       |
| --------------- | ---------------- | -------- | ----------------------------------------------------------------- |
| `itemId`        | `string`         | Yes      | Unique identifier (e.g. `potm:3:tier1`, `pulse:abc`)              |
| `source`        | `string`         | Yes      | Surface tag: `showcase`, `pulse`, `builder`, `image-quality-vote` |
| `platformId`    | `string`         | No       | Provider ID for per-platform learning                             |
| `tier`          | `number` (1–4)   | No       | Platform tier                                                     |
| `initialCounts` | `FeedbackCounts` | No       | Server-provided initial counts                                    |

### 5.2 Visual Specification

| Property        | Value                                                         |
| --------------- | ------------------------------------------------------------- |
| Emoji size      | `clamp(14px, 1.1vw, 18px)` — matches leaderboard thumb (18px) |
| Count font      | `clamp(0.55rem, 0.7vw, 0.85rem)`, `tabular-nums font-medium`  |
| Count colours   | 👍 `#34D399` · 👌 `#FBBF24` · 👎 `#F87171`                    |
| Spacing         | `clamp(6px, 0.5vw, 10px)` between emoji-count pairs           |
| Selected state  | `scale(1.15)` + `drop-shadow` glow in rating colour           |
| Unselected grey | `opacity: 0.3` after vote                                     |

### 5.3 Vote Behaviour

1. User clicks one emoji → vote is locked
2. Selected emoji scales up with coloured glow
3. Other two emojis grey out to 30% opacity
4. Count increments optimistically
5. `sendFeedbackDirect()` fires (fire-and-forget)
6. Vote persisted to `sessionStorage` per `itemId` — survives page navigation within session

**No un-voting.** Once clicked, the choice is final for this session. This produces cleaner signals than toggle-based systems where users click/unclick repeatedly.

---

## 6. API Endpoint

**POST /api/feedback**

**File:** `src/app/api/feedback/route.ts` (334 lines)

### 6.1 Request Schema (Zod-validated)

| Field                | Type                                    | Required | Notes                                           |
| -------------------- | --------------------------------------- | -------- | ----------------------------------------------- |
| `promptEventId`      | `string` (1–128 chars)                  | Yes      | Links feedback to its source item               |
| `rating`             | `'positive' \| 'neutral' \| 'negative'` | Yes      | The user's rating choice                        |
| `credibilityScore`   | `number` (0–2)                          | Yes      | Client-computed, server-validated range         |
| `credibilityFactors` | `{ tier, age, frequency, speed }`       | Yes      | Per-factor breakdown for admin drill-down       |
| `responseTimeMs`     | `integer` (0–604800000)                 | Yes      | Time between action and feedback (0 for inline) |
| `platform`           | `string` (1–64 chars)                   | Yes      | Platform ID (e.g. `'leonardo'`, `'unknown'`)    |
| `tier`               | `integer` (1–4)                         | Yes      | Platform tier                                   |
| `userTier`           | `string \| null`                        | No       | `'free'`, `'paid'`, or null                     |
| `accountAgeDays`     | `integer \| null`                       | No       | Account age at time of feedback                 |

### 6.2 Security

- Zod validation at boundary — no unvalidated data reaches DB
- In-memory rate limiting (5/min prod, generous in dev)
- GDPR safe — no user IDs, no IPs stored in DB
- Idempotent — one feedback per `promptEventId`, first one wins (`ON CONFLICT DO NOTHING`)
- Safe mode — accepts but doesn't persist during incidents (keeps frontend happy)

---

## 7. Database Schema

**Table:** `feedback_events`

```sql
CREATE TABLE feedback_events (
  id                TEXT PRIMARY KEY,
  prompt_event_id   TEXT NOT NULL,
  rating            TEXT NOT NULL,           -- 'positive' | 'neutral' | 'negative'
  credibility_score NUMERIC(4,2) NOT NULL,
  response_time_ms  INTEGER NOT NULL,
  platform          TEXT NOT NULL,
  tier              INTEGER NOT NULL,
  user_tier         TEXT,
  account_age_days  INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_feedback_events_unique_prompt
  ON feedback_events (prompt_event_id);

CREATE INDEX idx_feedback_events_platform
  ON feedback_events (platform, tier, created_at);
```

### 7.1 Dual Write

The `/api/feedback` route performs a dual write:

1. `INSERT INTO feedback_events` — full detail for admin + cron
2. `UPDATE prompt_events SET feedback_rating, feedback_credibility` — links feedback back to original telemetry event (when `promptEventId` matches a real `prompt_events` row)

For inline widget feedback (showcase, pulse, image quality), the `promptEventId` is a synthetic ID (e.g. `potm:3:tier1`, `iq:leonardo`) that won't match a real `prompt_events` row — the UPDATE is a no-op, and that's fine. The `feedback_events` INSERT is the primary purpose.

---

## 8. Learning Pipeline Integration

### 8.1 Credibility Scoring (Phase 7.10a)

**File:** `src/types/feedback.ts` (328 lines)

Four-factor formula:

```
credibility = tierMult × ageMult × frequencyMult × speedMult
```

| Factor    | What it measures                                 | Range    |
| --------- | ------------------------------------------------ | -------- |
| Tier      | Paid users more deliberate (1.0 free, 1.25 paid) | 1.0–1.25 |
| Age       | Long-tenured users have developed taste          | 0.8–1.3  |
| Frequency | Power users test more prompts                    | 0.7–1.2  |
| Speed     | Faster rating = fresher signal                   | 0.5–1.5  |

Result clamped to `[CREDIBILITY_MIN, CREDIBILITY_MAX]` (currently 0.5–2.0).

**For inline widgets** (`sendFeedbackDirect`): credibility defaults to 1.0 because account context is unavailable. These are volume signals. The credibility system gives higher-context signals (from the builder's post-copy flow) proportionally more weight.

### 8.2 Streak Detection (Phase 7.10f)

**File:** `src/lib/learning/feedback-streaks.ts` (335 lines)

| Streak Type    | Pattern           | Action                                        |
| -------------- | ----------------- | --------------------------------------------- |
| 🔥 Hot         | 3+ consecutive 👍 | Boost term combo weights                      |
| ❄️ Cold        | 3+ consecutive 👎 | Flag for admin review                         |
| 🔄 Oscillating | Alternating 👍👎  | High-variance — useful for A/B test decisions |

### 8.3 Scene Enhancer (Phase 7.10e)

**File:** `src/lib/feedback/feedback-scene-enhancer.ts` (295 lines)

When a user loads a scene, this silently enriches scene prefills with terms proven by their own feedback history. Only adds within same category, only when signal is strong (count ≥ `MIN_HINT_COUNT`), never removes scene defaults.

### 8.4 Confidence Halos (Phase 7.10b)

Scene cards display subtle glow rings based on historical feedback overlap:

| Level  | Glow                  | Threshold           |
| ------ | --------------------- | ------------------- |
| Proven | Emerald + breathing   | 3+ positive matches |
| Warm   | Faint emerald outline | 1–2 positive        |
| Risky  | Amber warning ring    | 2+ negative         |
| Null   | No halo               | Insufficient data   |

### 8.5 Admin Dashboard (Phase 7.11, Section 10)

**File:** `src/components/admin/scoring-health/feedback-summary-panel.tsx` (451 lines)

Dashboard at `/admin/scoring-health` shows:

- 👍/👌/👎 distribution (overall + per-platform)
- Per-platform satisfaction rates
- Terms with highest 👎 rate
- Correlation between prompt score and user rating
- Drill-through to anti-patterns panel

### 8.6 Nightly Cron Aggregation

**File:** `src/app/api/learning/aggregate/route.ts` (17-layer cron pipeline)

Feedback data is aggregated alongside all other learning signals. Weighted by credibility score. Feeds into co-occurrence matrix updates, term quality recalibration, and scorer weight adjustments.

### 8.7 Learning Pipeline Integration — Gap Fixes (7 March 2026)

Three architectural gaps between the feedback system and the learning pipeline were identified and fixed:

**Gap 1 — Dead Wire Fix:** `feedback_rating` and `feedback_credibility` were written to the `prompt_events` table but never read back. The two SELECT queries in `database.ts` that feed all learning engines omitted these columns, and `PromptEventRow` fields were never populated. Fix: added both columns to both SELECTs. Created `outcomeWithFeedback()` helper in `outcome-score.ts` (pure function, zero-allocation fast path when no feedback). All 5 engines now call `computeOutcomeScore(outcomeWithFeedback(e.outcome, e.feedback_rating, e.feedback_credibility))`. Effect: every 👍👌👎 immediately influences term-quality scoring, weight recalibration, magic combo mining, anti-pattern detection, and category value discovery.

**Gap 2 — PotM Showcase Telemetry:** Homepage feedback used synthetic IDs (`potm:3:tier1`) that didn't match any real `prompt_events` row. The learning pipeline couldn't trace feedback back to specific terms. Fix: `sendShowcaseTelemetry()` fires when a user views a PotM prompt, creating a real `prompt_events` row with a deterministic ID and full 12-category term selections (via `selectionsFromMap()`). `ON CONFLICT (id) DO NOTHING` makes it idempotent. The FeedbackWidget's `itemId` matches the deterministic ID exactly, so when the user clicks 👍👌👎, the feedback links to real selections. The nightly cron can now trace: "user rated 👎 → prompt had terms X, Y, Z → those terms get penalised."

**Gap 3 — Category Feedback Sentiment:** `category-value-discovery.ts` (v2.0.0) now computes per-category feedback sentiment from events that have direct 👍👌👎 ratings. For each category, counts how many 👍 vs 👎 land on prompts containing that category. `feedbackSentiment = (positive - negative) / total`. Range: -1.0 (all 👎) to +1.0 (all 👍). null if < 5 feedback events. Negative sentiment → category vocabulary needs diversification. Computed in the same fused loop as the existing outcome comparison — zero extra iteration.

**Files changed by gap fixes:**

| File                                                     | Change                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/learning/outcome-score.ts` (609→653 lines)      | Added `outcomeWithFeedback()` helper                               |
| `src/lib/learning/database.ts` (1,036→1,037 lines)       | Both SELECTs now include `feedback_rating`, `feedback_credibility` |
| `src/lib/learning/term-quality-scoring.ts` (399→400)     | Uses `outcomeWithFeedback()`                                       |
| `src/lib/learning/weight-recalibration.ts` (471→472)     | Uses `outcomeWithFeedback()`                                       |
| `src/lib/learning/magic-combo-mining.ts` (595→596)       | Uses `outcomeWithFeedback()`                                       |
| `src/lib/learning/anti-pattern-detection.ts` (370→371)   | Uses `outcomeWithFeedback()`                                       |
| `src/lib/learning/category-value-discovery.ts` (380→463) | Gap 1 fix + Gap 3 feedback sentiment                               |
| `src/lib/telemetry/prompt-telemetry-client.ts` (336→420) | Added `sendShowcaseTelemetry()`                                    |
| `src/app/api/prompt-telemetry/route.ts` (265→267)        | `deterministicId` + `ON CONFLICT`                                  |
| `src/types/prompt-telemetry.ts` (272→279)                | Added `deterministicId` to Zod schema                              |
| `src/components/home/prompt-showcase.tsx` (1,357→1,378)  | Fires `sendShowcaseTelemetry()` on tier view                       |

---

## 9. What Was Retired

### 9.1 Old Like System (Replaced 7 March 2026)

| Component                             | Status   | Reason                                          |
| ------------------------------------- | -------- | ----------------------------------------------- |
| `LikeButton` in `prompt-showcase.tsx` | Deleted  | Replaced by `FeedbackWidget`                    |
| ♡♥ hearts in `community-pulse.tsx`    | Deleted  | Replaced by `FeedbackWidget`                    |
| `use-like.ts` hook (203 lines)        | Orphaned | No longer imported by any homepage component    |
| `/api/prompts/like` route             | Orphaned | No longer called by any frontend component      |
| `/api/prompts/like/status` route      | Orphaned | No longer called by any frontend component      |
| `prompt_likes` table                  | Orphaned | No new writes; old data preserved for migration |

**Migration note:** The `prompt_likes` table still exists in the database. Old like data can be migrated to `feedback_events` as `rating: 'positive'` if historical signal is wanted. The orphaned files can be deleted at the next cleanup pass.

### 9.2 Why Hearts Were Replaced

Binary likes (♡/♥) only capture "I like this." They cannot capture "this is mediocre" or "this is bad." The negative signal — knowing what doesn't work — is the most valuable signal for improving prompts. Hearts left half the story untold.

---

## 10. Image Quality Vote — Dual Write

The Image Quality vote button in the leaderboard table stays as 👍 only (SVG thumb, not emoji). Its primary write goes to `/api/providers/vote` → `image_quality_votes` table → Bayesian Elo calculation. This is unchanged.

**Added:** After a successful vote, the hook also fires `sendFeedbackDirect()` with:

```typescript
{
  promptEventId: `iq:${providerId}`,
  rating: 'positive',
  platform: providerId,
  tier: 1,
  source: 'image-quality-vote',
}
```

This dual-write ensures the learning pipeline sees Image Quality votes alongside prompt feedback. The Elo calculation is unaffected — it continues reading from its own table.

---

## 11. File Locations

| File                                                             | Lines | Purpose                                              |
| ---------------------------------------------------------------- | ----- | ---------------------------------------------------- |
| `src/components/ux/feedback-widget.tsx`                          | 210   | Compact inline 👍👌👎 widget (NEW)                   |
| `src/lib/feedback/feedback-client.ts`                            | 292   | `sendFeedback()` + `sendFeedbackDirect()` (EXTENDED) |
| `src/app/api/feedback/route.ts`                                  | 334   | Unified feedback endpoint                            |
| `src/types/feedback.ts`                                          | 328   | Rating types + credibility scoring                   |
| `src/lib/learning/feedback-streaks.ts`                           | 335   | Hot/cold/oscillating streak detection                |
| `src/lib/feedback/feedback-scene-enhancer.ts`                    | 295   | Personalise scene prefills from feedback             |
| `src/hooks/use-feedback-memory.ts`                               | 355   | React hook for term-level feedback hints             |
| `src/components/ux/feedback-invitation.tsx`                      | 381   | Full overlay 👍👌👎 (post-copy builder flow)         |
| `src/components/admin/scoring-health/feedback-summary-panel.tsx` | 451   | Admin dashboard Section 10                           |
| `src/hooks/use-image-quality-vote.ts`                            | 337   | Image quality vote hook (EXTENDED — dual write)      |
| `src/lib/learning/outcome-score.ts`                              | 653   | `outcomeWithFeedback()` helper (Gap 1)               |
| `src/lib/learning/category-value-discovery.ts`                   | 463   | Feedback sentiment per category (Gap 3, v2.0.0)      |
| `src/lib/telemetry/prompt-telemetry-client.ts`                   | 420   | `sendShowcaseTelemetry()` for PotM (Gap 2)           |

---

## 12. Rules for Future Surfaces

1. **Use `FeedbackWidget`** for any new inline feedback UI. Do not create new like components.
2. **Use `sendFeedbackDirect()`** for any new fire-and-forget feedback calls. Do not create new endpoints.
3. **All feedback goes to `/api/feedback`** → `feedback_events` table. No new tables for signals.
4. **Use the `source` tag** to distinguish where feedback originated. This enables per-surface analysis in the admin dashboard.
5. **`itemId` must be unique and deterministic** — the same item viewed twice should produce the same `itemId` so the idempotency constraint prevents duplicate votes.
6. **No un-voting.** One click, locked. Cleaner signals than toggles.

---

## 13. Related Documents

| Document                                    | What needs updating                                              |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `homepage.md` §7                            | ✅ Done (v6.0.0) — §7 rewritten as "Feedback System"             |
| `paid_tier.md` §2.1                         | "Like system" free feature line must reference new 👍👌👎 system |
| `prompt-builder-evolution-plan-v2.md` §7.10 | ✅ Done (v2.4.0) — §7.10h + Gap 1/2/3 documented                 |

---

## Changelog

- **7 Mar 2026 — v2.0.0:** **GAP 1/2/3 PIPELINE INTEGRATION.** Added §8.7 documenting three learning pipeline gap fixes: Gap 1 (dead wire — feedback columns now read by all 5 learning engines via `outcomeWithFeedback()`), Gap 2 (PotM showcase fires `sendShowcaseTelemetry()` creating real `prompt_events` rows so homepage feedback traces back to specific terms), Gap 3 (category-value-discovery v2.0.0 computes per-category `feedbackSentiment`). Updated §4.1 data flow diagram with all three integration paths. Updated §3 PotM itemId to note deterministic linking. Added 4 new files to §11. Marked §13 related doc updates as complete.

- **7 Mar 2026 — v1.0.0:** Initial version. Unified all feedback signals under one system. Hearts retired from PotM showcase and Community Pulse. FeedbackWidget created. Image Quality votes dual-write to feedback_events. `the-like-system.md` established as authority for all user quality signals.

---

# Part 2 — API Calming Efficiency


> **Authority Document** | Living reference for API cost control and efficiency  
> **Location:** `docs/authority/api-calming-efficiency.md`  
> **Companion:** `promagen-api-brain-v2.md` (architecture spec)  
> **Last updated:** 7 February 2026 — Full audit, all feeds verified against code

---

## Purpose

This document is the **single source of truth** for Promagen's API calming efficiency. It tracks:

- What calming techniques are implemented
- How effective each technique is (with metrics)
- What improvements are planned
- Lessons learned from incidents

**Goal:** Achieve and maintain **≤50% daily API budget usage per provider** while keeping all four data feeds (FX, Indices, Commodities, Weather) feeling "alive."

---

## Current Feed Status (Feb 7, 2026)

| Feed            | Status      | Provider       | Mode     | Data        |
| --------------- | ----------- | -------------- | -------- | ----------- |
| **FX**          | ✅ **LIVE** | TwelveData     | `cached` | Real prices |
| **Indices**     | ✅ **LIVE** | Marketstack    | `live`   | Real prices |
| **Commodities** | ✅ **LIVE** | Marketstack v2 | `live`   | Real prices |
| **Weather**     | ✅ **LIVE** | OpenWeatherMap | `cached` | Real data   |

> **Crypto** was removed entirely (no imports, no endpoint, no handler). Slots :20/:50 are now free.

---

## Current Efficiency Score

| Metric               | Target        | Current        | Status       |
| -------------------- | ------------- | -------------- | ------------ |
| TwelveData usage     | ≤50% of 800   | ~48–96 (6–12%) | 🟢 Excellent |
| Marketstack usage    | ≤50% of 3,333 | ~192 (5.8%)    | 🟢 Excellent |
| OpenWeatherMap usage | ≤50% of 1,000 | ~576 (57.6%)   | 🟡 Moderate  |
| Cache hit rate       | ≥95%          | ~98%           | 🟢 Excellent |
| P95 response time    | <200ms        | ~50ms (cached) | 🟢 Excellent |
| Budget blocks/month  | 0             | 0              | 🟢 Clean     |

**Overall Efficiency Grade: A**

_Last measured: February 7, 2026_

---

## Architecture Overview (Provider-Based)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CALMING LAYERS (PROVIDER-BASED ARCHITECTURE)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: Frontend (Vercel)                                                 │
│  ├── Polling interval alignment (per feed schedule)                         │
│  ├── Visibility-aware backoff (6x when hidden)                              │
│  ├── Centralised polling store (one timer per feed globally)                │
│  ├── Client-side rate limiting (240 req/min)                                │
│  └── API Timing Stagger (prevents simultaneous upstream calls)              │
│      ├── FX:          :00, :30 (base schedule)       → TwelveData ✅        │
│      ├── Indices:     :05, :20, :35, :50 (15-min)   → Marketstack ✅       │
│      ├── Weather:     :10, :40 (30-min)              → OpenWeatherMap ✅    │
│      └── Commodities: rolling 5-min (not clock-aligned) → Marketstack ✅   │
│                                                                             │
│  LAYER 2: Gateway (Fly.io) — PROVIDER-BASED MODULES                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  twelvedata/          │  marketstack/            │  openweathermap/   │  │
│  │  ├── budget.ts        │  ├── budget.ts           │  ├── handler.ts    │  │
│  │  │   (800/day)        │  │   (3,333/day shared)  │  │   (1,000/day)  │  │
│  │  ├── scheduler.ts     │  ├── scheduler.ts        │  └── ...           │  │
│  │  │   (clock-aligned)  │  │   (:05/:20/:35/:50)   │                    │  │
│  │  ├── adapter.ts       │  ├── commodities-        │                    │  │
│  │  └── fx.ts ✅ LIVE    │  │   scheduler.ts        │                    │  │
│  │                       │  │   (rolling 5-min)      │                    │  │
│  │                       │  ├── indices.ts ✅ LIVE   │                    │  │
│  │                       │  └── commodities.ts ✅    │                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  LAYER 3: Providers (Completely Separate Budgets)                           │
│  ┌─────────────────────┬──────────────────────────┬────────────────────┐    │
│  │ TwelveData (800/day)│ Marketstack (3,333/day)  │ OWM (1,000/day)   │    │
│  │ FX only ✅ LIVE     │ Indices + Commodities ✅ │ Weather ✅ LIVE    │    │
│  │ Clock-aligned       │ Indices: clock-aligned   │ Clock-aligned      │    │
│  │                     │ Commodities: rolling     │ :10, :40           │    │
│  └─────────────────────┴──────────────────────────┴────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Four-Feed Architecture (Feb 7, 2026)

All four data feeds share **identical calming architecture** with provider-specific configuration:

| Component              | FX                 | Indices                 | Commodities                   | Weather                 |
| ---------------------- | ------------------ | ----------------------- | ----------------------------- | ----------------------- |
| **Status**             | ✅ LIVE            | ✅ LIVE                 | ✅ LIVE                       | ✅ LIVE                 |
| **Gateway endpoint**   | `/fx`              | `/indices`              | `/commodities`                | `/weather`              |
| **Frontend API route** | `/api/fx`          | `/api/indices`          | `/api/commodities`            | `/api/weather`          |
| **Frontend hook**      | `use-fx-quotes.ts` | `use-indices-quotes.ts` | `use-commodities-quotes.ts`   | `use-fetch-interval.ts` |
| **Display location**   | FX Ribbon          | Exchange Cards          | Commodities Windows           | Weather Section         |
| **Cache key**          | `fx:ribbon:all`    | `indices:ribbon`        | per-commodity (e.g. `coffee`) | `weather:all`           |
| **TTL**                | 1800s (30 min)     | 7200s (2 hr)            | 7200s (2 hr) per-commodity    | 300s (5 min)            |
| **Refresh schedule**   | :00, :30           | :05, :20, :35, :50      | Rolling every 5 min           | :10, :40                |
| **Default items**      | 8 pairs            | 16 exchanges            | 7 commodities (2-3-2 groups)  | 48 cities (2 batches)   |
| **Provider**           | TwelveData         | Marketstack             | Marketstack v2                | OpenWeatherMap          |
| **Provider folder**    | `twelvedata/`      | `marketstack/`          | `marketstack/`                | `openweathermap/`       |
| **Daily budget**       | shared 800         | 3,333 (shared pool)     | 3,333 (shared pool) + 1K cap  | 1,000 (separate)        |
| **Calls/day**          | ~48–96             | ~96                     | ~288                          | ~576                    |

### API Timing Stagger (Critical)

To prevent simultaneous upstream calls, each feed refreshes at **staggered intervals**:

```
Hour timeline (every hour):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │WTH │IDX │ FX │IDX │WTH │IDX │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑   ↑    ↑    ↑    ↑    ↑    ↑
  TD   MS  OWM  MS   TD   MS  OWM  MS

+ Commodities: rolling every 5 min (Marketstack v2, not clock-aligned)

TD  = TwelveData (800/day budget, FX only)
MS  = Marketstack (3,333/day shared budget, Indices + Commodities)
OWM = OpenWeatherMap (1,000/day budget, Weather)
```

**Gateway Implementation (marketstack/scheduler.ts):**

```typescript
/**
 * Clock-aligned scheduler for Marketstack Indices.
 * UPDATED: 2026-01-31 — Changed to 15-minute refresh (4×/hour)
 *
 * Indices: :05, :20, :35, :50 — staggered from TwelveData feeds.
 */

const MARKETSTACK_SLOTS = {
  indices: [5, 20, 35, 50] as const, // Every 15 minutes
};
```

**Commodities Rolling Scheduler (marketstack/commodities-scheduler.ts):**

```typescript
/**
 * Rolling scheduler — NOT clock-aligned (by design).
 * Marketstack commodities: 1 commodity per API call (no batching).
 * 78 commodities × 5 min = 390 min (~6.5 hours) per full cycle.
 *
 * Queue order per cycle:
 * 1. Double-word IDs first (22 items, deterministic — URL encoding verification)
 * 2. Priority/default IDs next (deterministic)
 * 3. Remaining IDs SHUFFLED (Fisher-Yates randomisation)
 */

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
```

**Why clock-aligned for FX/Indices/Weather (not 90% TTL)?**

Old approach:

```typescript
// ❌ BAD: 90% of TTL creates drift
setInterval(() => refresh(), config.ttlSeconds * 1000 * 0.9);
// FX starts at :00, refreshes at :27, :54, :21, :48...
// Eventually feeds COLLIDE → rate limit exceeded!
```

New approach:

```typescript
// ✅ GOOD: Clock-aligned slots, never drift
setTimeout(() => {
  refresh();
  setInterval(() => refresh(), 15 * 60 * 1000); // Exactly 15 min for indices
}, getMsUntilNextSlot('indices')); // Wait for :05, :20, :35, or :50
// FX ALWAYS at :00, :30
// Indices ALWAYS at :05, :20, :35, :50
// Weather ALWAYS at :10, :40
// NEVER collide!
```

**Why rolling for Commodities (not clock-aligned)?**

- Marketstack v2 commodities endpoint: **1 commodity per call** (no batching)
- 78 commodities to cycle through
- Clock-aligned slots would mean cramming 78 calls into a single time window
- Rolling every 5 minutes spreads the load evenly
- Queue randomisation per cycle ensures fair distribution over time

---

## CRITICAL: No Demo Prices Ever

**This is a hard rule documented in memory:**

> "There is no synthetic demo market data on the homepage ribbon."
> "Fallback must return null (renders as '—')."

When live API data is unavailable, the gateway returns:

```typescript
price: null; // NEVER demo prices
```

The frontend renders `null` as `—` (em dash). This is intentional and correct.

---

## Implemented Techniques

### Technique Registry (All Four Feeds)

| #   | Technique                  | Layer    | Applied To        | Efficiency Impact                  | Status    |
| --- | -------------------------- | -------- | ----------------- | ---------------------------------- | --------- |
| 1   | **TTL Cache**              | Gateway  | FX, IDX, COM, WTH | High (95%+ hit rate)               | ✅ Active |
| 2   | **Request Deduplication**  | Gateway  | FX, IDX           | Medium (prevents thundering herd)  | ✅ Active |
| 3   | **Batch Requests**         | Gateway  | FX, IDX, WTH      | Critical (N symbols = 1 call)      | ✅ Active |
| 4   | **Stale-While-Revalidate** | Gateway  | FX, IDX, COM, WTH | Medium (UX smoothness)             | ✅ Active |
| 5   | **Background Refresh**     | Gateway  | FX, IDX, COM, WTH | Medium (proactive cache warm)      | ✅ Active |
| 6   | **Budget Management**      | Gateway  | FX, IDX, COM, WTH | Critical (hard stop)               | ✅ Active |
| 7   | **Circuit Breaker**        | Gateway  | FX, IDX, COM      | High (429/5xx protection)          | ✅ Active |
| 8   | **Clock-Aligned Refresh**  | Both     | FX, IDX, WTH      | Critical (no drift collisions)     | ✅ Active |
| 9   | **Visibility Backoff**     | Frontend | FX, IDX, COM      | Medium (6x slower when hidden)     | ✅ Active |
| 10  | **Centralised Polling**    | Frontend | FX, IDX, COM      | High (one timer globally)          | ✅ Active |
| 11  | **Client Rate Limiting**   | Frontend | All               | Low (defence in depth)             | ✅ Active |
| 12  | **SSOT Config**            | Both     | All               | Medium (no stale config)           | ✅ Active |
| 13  | **Provider Isolation**     | Gateway  | All               | High (separate budgets)            | ✅ Active |
| 14  | **Null Fallback**          | Gateway  | All               | N/A (no demo prices)               | ✅ Active |
| 15  | **Provider-Based Modules** | Gateway  | All               | High (clear ownership)             | ✅ Active |
| 16  | **Rolling Scheduler**      | Gateway  | COM               | High (even load distribution)      | ✅ Active |
| 17  | **Queue Randomisation**    | Gateway  | COM               | Medium (fair refresh distribution) | ✅ Active |

**Notes:**

- Technique #2 (Request Dedup): Commodities is implicit 1-at-a-time via rolling scheduler. Weather uses batch dedup.
- Technique #3 (Batch): Commodities cannot batch — Marketstack v2 supports 1 commodity per call. All others batch.
- Technique #8 (Clock-Aligned): Commodities uses ROLLING instead (by design — 78 items, 1-per-call API). All others clock-aligned.
- Techniques #16–17 are new (added Feb 7, 2026) to document commodities-specific calming.

---

## Budget Breakdown (Feb 7, 2026)

### Per-Provider Daily Usage

| Provider              | Feed        | Schedule                    | Calls/Day | Budget/Day     | Usage %   | Headroom |
| --------------------- | ----------- | --------------------------- | --------- | -------------- | --------- | -------- |
| TwelveData            | FX          | :00, :30 (2×/hr)            | ~48–96    | 800            | 6–12%     | ~88%     |
| Marketstack           | Indices     | :05, :20, :35, :50 (4×/hr)  | ~96       | 3,333 (shared) | 2.9%      | —        |
| Marketstack           | Commodities | Rolling 5-min               | ~288      | 3,333 (shared) | 8.6%      | —        |
| **Marketstack total** |             |                             | **~384**  | **3,333**      | **11.5%** | **~88%** |
| OpenWeatherMap        | Weather     | :10, :40 (2×/hr, 2 batches) | ~576      | 1,000          | 57.6%     | ~42%     |

### Marketstack Budget Detail

```
Plan: Professional ($49/month)
Monthly: 100,000 API calls
Daily:   100,000 ÷ 30 = 3,333 calls/day
Minute:  60 calls/min (generous cap)

Indices:     ~96 calls/day  (clock-aligned, batched)
Commodities: ~288 calls/day (rolling 5-min, 1-per-call)
─────────────────────────────────
Total:       ~384 calls/day  = 11.5% of 3,333

Separate budget trackers:
- marketstack/budget.ts        → shared pool 3,333/day (indices)
- marketstack/commodities-budget.ts → 1,000/day cap (commodities only)

The 1,000/day commodities cap prevents runaway usage from starving indices.
Both draw from the same API key (3,333/day total).
```

### TwelveData Budget Detail

```
Plan: Free tier
Daily: 800 API calls/day

FX only: ~48–96 calls/day (clock-aligned :00/:30)
─────────────────────────────────
Total:   ~48–96 calls/day = 6–12% of 800

Note: Crypto was removed. TwelveData now serves FX only.
Previous usage (~256/day with crypto) was ~32%.
Current usage is dramatically lower.
```

### OpenWeatherMap Budget Detail

```
Plan: Free tier
Daily: 1,000 API calls/day

Weather: 48 cities × 2 batches (24 each) × alternating hourly
~576 calls/day = 57.6%
─────────────────────────────────
Highest utilisation of any provider but within target.
```

---

## Commodities Scheduler — Deep Dive

The commodities feed has a unique architecture because Marketstack's v2 commodities endpoint supports **only 1 commodity per API call** (no batching).

### Scheduler Design

```
┌──────────────────────────────────────────────────────────────┐
│  COMMODITIES ROLLING SCHEDULER                               │
│                                                              │
│  Interval: 5 minutes between fetches                         │
│  Queue size: 78 commodities                                  │
│  Full cycle: 78 × 5 min = 390 min (~6.5 hours)              │
│  Cycles/day: ~3.7                                            │
│  Calls/day: ~288                                             │
│                                                              │
│  Queue order per cycle:                                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 1. Double-word IDs (22 items, deterministic)          │    │
│  │    crude_oil, natural_gas, ttf_gas, iron_ore, ...     │    │
│  │    → Verify URL encoding fix works first              │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ 2. Priority/default IDs (deterministic)               │    │
│  │    User's selected commodities (from SSOT)            │    │
│  │    → Most-viewed commodities refresh early            │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ 3. Remaining IDs (SHUFFLED via Fisher-Yates)          │    │
│  │    Different random order every cycle                 │    │
│  │    → 78! permutations (~1.1 × 10^115)                │    │
│  │    → Even refresh distribution over time              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Calming layers:                                             │
│  ├── Per-commodity cache (7200s TTL, stale-while-revalidate) │
│  ├── Separate budget tracker (1,000/day cap)                 │
│  ├── Circuit breaker (3 failures → open 30s)                 │
│  ├── Min interval guard (2 min floor)                        │
│  └── Env override: COMMODITIES_REFRESH_INTERVAL_MS           │
└──────────────────────────────────────────────────────────────┘
```

### Cold-Start Behaviour

- Uncached commodities return `price: null` (renders as "—")
- NO demo/fallback prices ever
- After ~6.5 hours the full catalog is populated
- Priority/default commodities populate within first ~35 minutes

---

## Incident Log

### INC-005: Benchmark Mapping Mismatch (Jan 14, 2026)

**Severity:** Medium  
**Duration:** ~2 hours  
**Impact:** 3 exchanges showing "···" instead of prices

**Root cause:** Frontend catalog used `djia`, `tsx`, `russell_2000` as benchmark keys. Gateway only mapped `dow_jones`, `tsx_composite`, and didn't have `russell_2000` at all.

**Resolution:** Added aliases to `gateway/src/marketstack/adapter.ts`:

```typescript
djia: 'DJI.INDX',           // Alias for dow_jones
tsx: 'GSPTSE.INDX',         // Alias for tsx_composite
russell_2000: 'RUT.INDX',   // New mapping
```

**Prevention:**

- Document all benchmark mappings in `EXPECTED-INDICES-REFERENCE.md`
- Test all selected exchanges against gateway mappings before deploy
- Add validation that checks catalog keys exist in gateway

### INC-004: Budget Overrun Investigation (Jan 14, 2026)

**Severity:** Medium  
**Duration:** Resolved  
**Impact:** 454/800 TwelveData credits by 7:15 AM UTC (57%)

**Root cause:** Background refresh using 90% TTL intervals instead of clock-aligned slots, causing FX and Crypto to eventually refresh simultaneously.

**Resolution:** Implemented clock-aligned scheduler in `twelvedata/scheduler.ts`.

**Prevention:**

- Provider-based folder structure isolates concerns
- Single scheduler.ts per provider enforces timing
- Clock-aligned slots prevent drift

### INC-003: Indices Endpoint Missing (Jan 13, 2026)

**Severity:** Medium  
**Duration:** ~2 hours  
**Impact:** Exchange cards showed no index data

**Root cause:** Gateway deployed without `/indices` endpoint.

**Resolution:** Merged indices code into server.ts.

### INC-002: TTL Misconfiguration (Jan 10, 2026)

**Severity:** High  
**Duration:** ~4 hours  
**Impact:** 3x expected API usage

**Root cause:** FX_RIBBON_TTL_SECONDS was 300 instead of 1800.

### INC-001: API Usage Explosion (Jan 9, 2026)

**Severity:** Critical  
**Duration:** ~12 hours  
**Impact:** 400% budget overage

**Root cause:** Multiple calming bypasses.

---

## Quick Reference

### "Is it working?" Checklist

```powershell
# 1. Gateway healthy?
(Invoke-RestMethod "https://promagen-api.fly.dev/health").status
# Expected: "ok"

# 2. All feeds returning data?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").meta.mode          # "cached" or "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").meta.mode     # "live"
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").meta.mode # "live" or "cached"
(Invoke-RestMethod "https://promagen-api.fly.dev/weather") | Select-Object -First 1  # has data

# 3. Data counts?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data.Count          # 8
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data.Count     # 8-16
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").data.Count # 7

# 4. Prices flowing?
(Invoke-RestMethod "https://promagen-api.fly.dev/fx").data[0].price       # number
(Invoke-RestMethod "https://promagen-api.fly.dev/indices").data | Select-Object id, price | Format-Table
(Invoke-RestMethod "https://promagen-api.fly.dev/commodities").data | Select-Object id, price | Format-Table

# 5. Commodities scheduler running?
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").commodities.scheduler
# Expected: running: true, intervalMs: 300000, randomised: true
```

### Emergency Actions

| Situation           | Action                                        |
| ------------------- | --------------------------------------------- |
| TwelveData blocked  | Wait for midnight UTC reset                   |
| Marketstack blocked | Wait for midnight UTC reset                   |
| OWM blocked         | Wait for midnight UTC reset                   |
| Gateway down        | `fly status -a promagen-api`                  |
| Circuit open        | Wait for auto-reset (30s for commodities)     |
| Rate limited        | Check scheduler.ts — slots should not overlap |
| Budget overrun      | Check budget.ts / commodities-budget.ts       |
| Missing prices      | Check benchmark mapping in adapter.ts         |
| Commodities stale   | Check /trace → commodities.scheduler.running  |

---

## Changelog

| Date       | Version | Change                                                           |
| ---------- | ------- | ---------------------------------------------------------------- |
| 2026-02-07 | 6.0.0   | **Full audit: doc corrected to match reality**                   |
|            |         | REMOVED: Crypto feed (no longer exists)                          |
|            |         | ADDED: Commodities LIVE (Marketstack v2, rolling)                |
|            |         | ADDED: Weather LIVE (OpenWeatherMap, :10/:40)                    |
|            |         | FIXED: Indices schedule :05/:20/:35/:50 (4×/hr)                  |
|            |         | FIXED: Marketstack budget 3,333/day (Professional)               |
|            |         | FIXED: TwelveData usage 6–12% (FX only)                          |
|            |         | FIXED: Timing stagger diagram (4 feeds, 3 providers)             |
|            |         | ADDED: Techniques #16 Rolling Scheduler, #17 Queue Randomisation |
|            |         | ADDED: Commodities scheduler deep-dive section                   |
|            |         | ADDED: Per-provider budget breakdown tables                      |
|            |         | Updated all status tables, architecture diagram                  |
|            |         | Updated quick reference checklist for 4 feeds                    |
| 2026-01-14 | 5.0.0   | PM: All feeds verified LIVE                                      |
|            |         | FX: TwelveData → mode: cached ✅                                 |
|            |         | Indices: Marketstack → mode: live ✅                             |
|            |         | Crypto: TwelveData → mode: cached ✅                             |
|            |         | Commodities: Parked → mode: fallback (null prices)               |
|            |         | Added INC-005 benchmark mapping incident                         |
|            |         | Updated status tables to show LIVE                               |
| 2026-01-14 | 4.0.0   | Major update: Provider-based architecture                        |
|            |         | Updated architecture diagram for provider folders                |
|            |         | Changed timing stagger to clock-aligned slots                    |
|            |         | Added scheduler.ts specification per provider                    |
|            |         | Added INC-004 budget investigation                               |
|            |         | Updated budget calculations                                      |
|            |         | Added technique #15: Provider-Based Modules                      |
| 2026-01-13 | 3.0.0   | Added Indices feed (Marketstack provider)                        |
| 2026-01-12 | 2.0.0   | Three-feed architecture                                          |
| 2026-01-10 | 1.1.0   | Fixed TTL from 300s to 1800s                                     |
| 2026-01-09 | 1.0.0   | Initial document                                                 |

---

## Review Schedule

- **Weekly:** Check efficiency metrics against targets
- **Monthly:** Review incident log, update roadmap progress
- **Quarterly:** Assess if new techniques needed

**Next Review:** February 14, 2026

---

_This is a living document. Update it whenever calming techniques change or incidents occur._

_**Critical rule:** NEVER use demo/synthetic prices. When API fails, return last-known-good (stale) data. Only return null (renders as "—") when no data has ever been cached._

---

## Changelog (Merged)

| Date | Change |
|------|--------|
| 9 Apr 2026 | v1.0.0: Merged like-system + api-calming-efficiency into single doc. |
| 7 Mar 2026 | the-like-system v2.0.0 |
| 7 Feb 2026 | api-calming-efficiency full audit |

_This document covers user engagement collection and API cost efficiency. `src.zip` is the SSoT._
