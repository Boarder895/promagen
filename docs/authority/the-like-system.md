# The Like System — Authority Document

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
