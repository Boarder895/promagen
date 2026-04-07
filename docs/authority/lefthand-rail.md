# Left-Hand Rail — Leaderboard Rail

**Version:** 2.0.0
**Created:** 2 April 2026
**Updated:** 6 April 2026
**Owner:** Promagen
**Status:** DEPLOYED — Leaderboard Rail live in production.
**Scope:** Prompt Lab (`/studio/playground`) left rail ONLY. Homepage and World Context left rails remain exchange-based — untouched.
**Authority:** This document defines the architecture, data flow, visual design, and file map for the Prompt Lab's left-hand rail.

> **Cross-references:**
>
> - `righthand-rail.md` — Companion doc for the right-hand Pipeline X-Ray rail
> - `index-rating.md` — Index Rating scoring system, Elo calculations, MPI
> - `code-standard.md` v4.0 — clamp(), no grey text, co-located animations, cursor-pointer
> - `builder-quality-intelligence.md` v3.0.0 — Internal scoring route (replaces killed user-facing Call 4)
> - `platform-config.json` + `platform-config.ts` — Platform SSOT (40 platforms)
> - `promagen-users-master.md` v4.0 — Demo data system including jitter controls

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [What It Replaced](#2-what-it-replaced)
3. [Architecture — LeaderboardRail](#3-architecture--leaderboardrail)
4. [Columns](#4-columns)
5. [Index Rating Integration](#5-index-rating-integration)
6. [Demo Jitter System](#6-demo-jitter-system)
7. [Sorting & Ranking](#7-sorting--ranking)
8. [Expand / Collapse](#8-expand--collapse)
9. [Selection & Provider Sync](#9-selection--provider-sync)
10. [Responsive Behaviour](#10-responsive-behaviour)
11. [Human Factors Declaration](#11-human-factors-declaration)
12. [Dead Code — PlatformMatchRail](#12-dead-code--platformmatchrail)
13. [Dead Code — Call 4 User-Facing Scoring](#13-dead-code--call-4-user-facing-scoring)
14. [File Map](#14-file-map)
15. [Non-Regression Rules](#15-non-regression-rules)
16. [Decisions Log](#16-decisions-log)

---

## 1. Purpose

The Prompt Lab's left rail is a compact leaderboard table showing all 40 AI image platforms ranked by Index Rating. It serves two functions:

1. **Discovery** — users see the ranked landscape of AI image platforms at a glance, with real-time rating changes and rank movement indicators.
2. **Navigation** — clicking a provider name selects it for optimisation in the centre column's PlaygroundWorkspace. The same handler as the centre dropdown — never a parallel mechanism.

The rail mirrors columns 1, 4, and 5 from the main `providers-table.tsx` leaderboard, maintaining a single visual language across the site.

---

## 2. What It Replaced

**Removed from Prompt Lab page only (v4.0.0, 2 Apr 2026):**

- `ReorderedExchangeRails` (left content)
- `ExchangeList` component rendering in the left rail
- All exchange-related data flow in `playground-page-client.tsx`
- `useIndicesQuotes` hook call (no exchange cards = no index data needed, saves API calls)

**NOT removed:**

- Exchange rails on homepage (`/`) — untouched
- Exchange rails on World Context (`/world-context`) — untouched
- Exchange rails on Pro Promagen page (`/pro-promagen`) — untouched
- `HomepageGrid` component — untouched (new rail content passes via `leftContent` prop)

The `HomepageGrid` three-column grid stays. The left rail's panel chrome stays. Only the content inside changed.

---

## 3. Architecture — LeaderboardRail

**Component:** `src/components/prompt-lab/leaderboard-rail.tsx`
**Version:** v4.0.0
**Imported by:** `src/app/studio/playground/playground-page-client.tsx` (line 67)

```typescript
export interface LeaderboardRailProps {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
  initialRatings?: Record<string, SerializableProviderRating>;
}
```

**Data sources:**

- `providers` — server-prefetched from `getProvidersWithPromagenUsers()`
- `initialRatings` — server-prefetched from `getIndexRatingsRecord()`, eliminates client waterfall
- Falls back to client-side `fetchIndexRatings()` if server prefetch is empty

The component uses `<table>` layout with the same CSS classes as the main providers table (`providers-table`, `providers-table-row`, etc.) to maintain visual consistency.

---

## 4. Columns

The rail renders 3 columns from the main leaderboard:

| Column                  | Content                                          | Width                      | Behaviour                                                                                                        |
| ----------------------- | ------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Col 1: Provider**     | Rank number + icon (20×20px fixed) + name        | 65%                        | Icon click → provider homepage (new tab, `stopPropagation`). Name/row click → selects provider for optimisation. |
| **Col 4: Support**      | `SupportIconsCell` — social icons                | 30%                        | **Hidden by default.** Only visible at `≥1800px` viewport width.                                                 |
| **Col 5: Index Rating** | `IndexRatingCell` — rating number + change arrow | 35% (default) / 25% (wide) | Sortable header. Green/red arrows for gain/loss.                                                                 |

**Not shown:** Flag, city, clock, weather emoji, API/affiliate emojis. These remain on the main leaderboard only.

All icons render at a fixed 20×20px with `padding: 2px`, `borderRadius: 5px`, and a subtle white ring (`box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.15)`). Fallback icon: `/icons/providers/fallback.png`.

---

## 5. Index Rating Integration

Ratings come from the Index Rating system (see `index-rating.md`):

- **+200 display inflation:** `DISPLAY_INFLATION_OFFSET` from `src/types/index-rating.ts` adds 200 to all raw Elo scores for user-facing display.
- **Change state:** `gain` (changePercent > 0.1), `loss` (changePercent < -0.1), `flat` (within ±0.1).
- **Rank-up indicator:** Green ⬆ arrow and `rank-climber-row` CSS class (flash animation) when `rankChangedAt` is within 24 hours.
- **Market power badges:** `isUnderdog` (MPI < 3.0) and `isNewcomer` (founding year < 1 year ago) computed from `market-power.json`.
- **Hydration safety:** `hasRankUp` forced to `false` until `hasMounted` state is true, preventing `Date.now()` server/client mismatch.
- **Fallback:** If no DB rating exists, score is derived from `provider.score * 20 + DISPLAY_INFLATION_OFFSET` with state `'fallback'`.

---

## 6. Demo Jitter System

Controlled by `NEXT_PUBLIC_DEMO_JITTER` environment variable (string `'true'` = on).

- **Interval:** 45 seconds (`DEMO_JITTER_INTERVAL`)
- **Range:** ±1 to ±3 points (`DEMO_JITTER_MIN` / `DEMO_JITTER_MAX`)
- **Application:** Jitter is applied AFTER sort — cosmetic display values only. Sort order uses stable base ratings and never swaps rows due to jitter.
- **Direction:** Random per provider per tick (50% positive, 50% negative).
- **Change arrows:** Jittered values produce green (gain) or red (loss) arrows in `IndexRatingCell`.
- **Reduced motion:** Jitter timer does not start if `prefers-reduced-motion: reduce` is active.
- **Hydration:** `jitterTick` starts at 0 (no jitter on first render), increments only after first interval completes.

**Same env var** (`NEXT_PUBLIC_DEMO_JITTER`) also controls the Promagen Users demo and the main Index Rating jitter on the homepage. Turning it off kills all three.

---

## 7. Sorting & Ranking

**Sort column:** Index Rating only (single `SortColumn` type: `'indexRating'`).
**Default:** Descending (highest rating first).
**Toggle:** Click the "Index Rating" header to flip between desc/asc.

**Rank assignment:** Ranks are computed from a separate `rankMap` that always sorts by rating descending, regardless of the display sort order. This means Craiyon at rank 40 stays "40." whether the table is sorted ascending or descending. Ranks are fixed, not display-order-dependent.

---

## 8. Expand / Collapse

- **Default:** Top 10 visible.
- **Expand:** "Show all 40" button (cyan text, `#22d3ee`).
- **Collapse:** "Show Top 10" button with ▼ arrow rotation (180° transform).
- **Hidden count:** Computed as `sorted.length - DEFAULT_VISIBLE`.

---

## 9. Selection & Provider Sync

Provider selection is lifted to page level in `playground-page-client.tsx`:

- **`selectedProviderId`** state lives in the page client, shared between left rail and centre workspace.
- **Left rail → centre:** `onSelectProvider(providerId)` calls `handleRailSelectProvider` which updates `selectedProviderId`. PlaygroundWorkspace receives this via `externalProviderId` prop.
- **Centre → left rail:** When the workspace dropdown changes, `handleProviderIdChange` updates `selectedProviderId`. Left rail highlights the matching row.

**Visual selection state:**

- Selected row: `bg-cyan-950/30` background, `3px solid rgba(34, 211, 238, 0.8)` left border.
- Unselected row: `3px solid transparent` left border.
- Transitions: `border-left 300ms ease, background-color 300ms ease`.

---

## 10. Responsive Behaviour

- **Default (all widths):** 2-column layout — Provider + Index Rating. Support column hidden via `display: none !important`.
- **≥1800px:** 3-column layout — Support column becomes visible. Provider width shrinks from 65% to 45%, Rating from 35% to 25%.
- **Horizontal scroll:** Disabled (`overflowX: 'hidden'`). Table uses `table-layout: fixed`.

---

## 11. Human Factors Declaration

| Element                 | Primary Factor             | Why                                                                                                                               |
| ----------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Ranked list with scores | Variable Reward (§2)       | Ratings change over time. Users check back to see movement — "did Midjourney overtake Leonardo?"                                  |
| Green/red change arrows | Loss Aversion (§8)         | Red arrows draw attention. Users notice losses more than gains — drives engagement with the platform they're watching.            |
| Rank-up flash           | Von Restorff Effect (§12)  | The flashing row breaks visual uniformity. "Something changed" — instant salience.                                                |
| Top 10 → Show All       | Curiosity Gap (§1)         | The hidden platforms below the fold create mild tension. "What's ranked 11th?"                                                    |
| Demo jitter             | Anticipatory Dopamine (§3) | Ratings shift every 45s. The next tick is unpredictable. Users watch for the next change.                                         |
| Icon → homepage link    | Fitts's Law (§13)          | Small but distinct target. Click icon = visit site. Click name = select for optimisation. Two actions, two targets, no ambiguity. |

---

## 12. Dead Code — PlatformMatchRail

`src/components/prompt-lab/platform-match-rail.tsx` still exists in the codebase but is **not imported by any active component**. It was the original left rail (v4.0.0, 2 Apr 2026) — a tier-grouped list with colour dots, no ratings, no ranking. It was superseded by `LeaderboardRail` which provides more value by showing the live leaderboard with Index Ratings.

**Status:** Should be deleted. Referenced only in stale comments:

- `playground-page-client.tsx` line 28 (comment: "Left: PlatformMatchRail")
- `leaderboard-rail.tsx` line 22 (comment: "same props contract as PlatformMatchRail")

---

## 13. Dead Code — Call 4 User-Facing Scoring

The original v1.0.0–v1.2.0 of this document designed a user-facing scoring engine (Call 4) that would fire after Call 3 and return a score out of 100 with improvement directives. **This was killed on 3 April 2026.**

**Root cause:** The scoring directives diagnosed problems caused by Call 3's builder, but directed the user to fix them. The user didn't cause the problems and couldn't fix them — creating a confusing and broken feedback loop.

**What was killed:**

- `usePromptScore` hook import and call in `playground-page-client.tsx`
- `prevOptimiseRef` + auto-fire `useEffect` for Call 4 triggering
- `scoreResult` / `isScoring` / `scoreError` props to `PipelineXRay`
- `XRayScore` component removed from Pipeline X-Ray right rail

**What survives:**

- `src/app/api/score-prompt/route.ts` — **stays deployed** as an internal builder quality regression tool, secured by `X-Builder-Quality-Key` header. Used by the BQI batch runner (`scripts/builder-quality-run.ts`) only.
- `src/hooks/use-prompt-score.ts` — **dead code**, still in codebase, should be deleted.
- `src/components/prompt-lab/xray-score.tsx` — **dead code**, still in codebase, should be deleted.

**Authority:** `builder-quality-intelligence.md` v3.0.0 §12.1 documents the scoring route's repurposing.

---

## 14. File Map

| File                                                   | Purpose                                          | Status                    |
| ------------------------------------------------------ | ------------------------------------------------ | ------------------------- |
| `src/components/prompt-lab/leaderboard-rail.tsx`       | Left rail: ranked leaderboard with Index Ratings | **ACTIVE** — production   |
| `src/components/providers/index-rating-cell.tsx`       | Rating display cell (shared with main table)     | ACTIVE — shared component |
| `src/components/providers/support-icons-cell.tsx`      | Social icons cell (shared with main table)       | ACTIVE — shared component |
| `src/types/index-rating.ts`                            | Rating types + `DISPLAY_INFLATION_OFFSET`        | ACTIVE — shared types     |
| `src/lib/index-rating/calculations.ts`                 | MPI calculation, Elo functions                   | ACTIVE — shared lib       |
| `src/data/providers/market-power.json`                 | Market power data for underdog/newcomer badges   | ACTIVE — shared data      |
| `src/app/studio/playground/playground-page-client.tsx` | Wires `LeaderboardRail` into left content slot   | ACTIVE — import line 67   |
| `src/components/prompt-lab/platform-match-rail.tsx`    | Original tier-grouped navigator                  | **DEAD CODE** — delete    |
| `src/hooks/use-prompt-score.ts`                        | Killed Call 4 client hook                        | **DEAD CODE** — delete    |
| `src/components/prompt-lab/xray-score.tsx`             | Killed Call 4 score display                      | **DEAD CODE** — delete    |

**No modifications to:**

- `HomepageGrid` (receives new content via existing `leftContent` prop)
- `platform-config.json` (all data already present)
- Any Call 1/2/3 routes or hooks
- Any of the 25 NL builder files
- Main `providers-table.tsx` (LeaderboardRail reuses its CSS classes)

---

## 15. Non-Regression Rules

1. Exchange rails on homepage, World Context, and Pro page must not be affected by any change in this rail.
2. `HomepageGrid` component must not be modified — new content passes via existing props.
3. Call 1, Call 2, and Call 3 routes must not be modified.
4. The 25 NL builder files must not be modified.
5. Platform selection from the left rail must use the same handler as the centre dropdown — never a parallel selection mechanism.
6. Rank numbers must be stable regardless of sort direction (computed from a fixed rating-descending ranking).
7. Demo jitter must be cosmetic only — applied after sort, never causing row reordering.
8. `prefers-reduced-motion` must disable jitter timer entirely.
9. No grey text — no `text-slate-500`, `text-slate-600`, no `text-white/[opacity < 0.4]`.
10. All sizing via `clamp()` — no fixed px/rem without clamp (icon sizes are the permitted exception at 20×20px fixed for consistency).
11. Co-located animations only — no new entries in `globals.css`.
12. No mention of AI, GPT, or OpenAI in any user-facing string.
13. `NEXT_PUBLIC_DEMO_JITTER` must gate all jitter — turning it off must kill demo jitter completely.
14. Hydration safety: no `Date.now()` or random values on first render. All time-dependent values must wait for `hasMounted`.

---

## 16. Decisions Log

| #   | Decision                                                   | Rationale                                                                                                                                                                                    | Date       |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D1  | Replace PlatformMatchRail with LeaderboardRail             | Tier-grouped list provided discovery but no engagement. Leaderboard with live ratings gives users a reason to return and watch. Variable Reward drives retention.                            | Apr 2026   |
| D2  | Reuse providers-table CSS classes                          | Single visual language. Users see the same table styling in the rail as on the main leaderboard page. No new CSS to maintain.                                                                | Apr 2026   |
| D3  | Top 10 default, expandable to 40                           | 10 platforms fit without scrolling on most viewports. "Show all" creates a Curiosity Gap for platforms below the fold.                                                                       | Apr 2026   |
| D4  | Rank computed from fixed descending sort, not display sort | Users sorting ascending should not see ranks flip. Rank 1 is always the highest-rated platform regardless of how the table is sorted.                                                        | Apr 2026   |
| D5  | Demo jitter applied after sort                             | Jitter is cosmetic entertainment. It must never cause rows to swap positions — that would make the rail feel broken. Sort-then-jitter guarantees stability.                                  | Apr 2026   |
| D6  | Icon click → homepage, name click → select                 | Two distinct user intents, two distinct targets. Prevents the "I wanted to visit the site but accidentally selected the platform" problem. `stopPropagation` on icon prevents row selection. | Apr 2026   |
| D7  | Hide Support column below 1800px                           | On typical laptop widths (1366–1536px), the rail is narrow. Three columns would crush the provider name. Two columns (Provider + Rating) are sufficient for the rail's primary purpose.      | Apr 2026   |
| D8  | Kill user-facing Call 4 scoring                            | Directives diagnosed builder problems but directed the user to fix them. Architectural conflict. Scoring route repurposed as internal BQI tool. See `builder-quality-intelligence.md`.       | 3 Apr 2026 |
| D9  | Server-prefetch initialRatings                             | Eliminates client waterfall. Page server component fetches ratings in parallel with providers, passes to client. Client only fetches if server data is empty.                                | Apr 2026   |

---

## Changelog

- **6 Apr 2026 (v2.0.0):** **COMPLETE REWRITE.** Document now reflects the deployed codebase (src.zip SSoT). LeaderboardRail replaced PlatformMatchRail as the active left rail component. All Call 4 user-facing scoring sections (§6–9 from v1.2.0) removed — Call 4 was killed on 3 Apr 2026 and repurposed as internal BQI tool. Dead code inventory added (PlatformMatchRail, use-prompt-score, xray-score). Index Rating integration, demo jitter system, sorting/ranking, responsive behaviour, and expand/collapse documented from actual code. Human factors updated for leaderboard engagement patterns. File map updated to reflect active vs dead files. Non-regression rules updated for jitter and hydration safety. Decisions log consolidated.
- **2 Apr 2026 (v1.2.0):** Final review polish. 5 precision fixes from ChatGPT review. Score non-comparability statement, client-side cache, benchmark dataset, ceremony scaling, display clamp clarification.
- **2 Apr 2026 (v1.1.0):** Post-review revision. 8-state client state machine, scoring rubric rewrite, calibration architecture, enriched request schema, expanded edge cases.
- **2 Apr 2026 (v1.0.0):** Initial version — PlatformMatchRail + Call 4 Prompt Scoring Engine design.

---

_This document is the authority for the Prompt Lab left-hand rail. Code in `src.zip` is the Single Source of Truth — this document describes what exists, not what is planned._
