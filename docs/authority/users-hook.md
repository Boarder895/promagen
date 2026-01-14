# Promagen User Hook Improvement Roadmap

> **Goal:** Raise website score from **72/100 → 90/100**  
> **Method:** Daily incremental improvements  
> **Core Problem:** Visitors see "a financial dashboard with an AI leaderboard" — not the creative magic of market data → prompts

---

## Current Scores Breakdown

| Area                      | Current | Target | Gap     |
| ------------------------- | ------- | ------ | ------- |
| Technical Architecture    | 90      | 90     | ✅ Done |
| Visual Design Foundation  | 75      | 85     | +10     |
| Feature Set               | 80      | 85     | +5      |
| Value Proposition Clarity | 55      | 85     | +30     |
| Visual Hierarchy & Focus  | 60      | 80     | +20     |
| Call-to-Action (CTA)      | 40      | 85     | +45     |
| Empty States & Loading    | 65      | 80     | +15     |
| Navigation & IA           | 50      | 80     | +30     |
| Mobile Experience         | 60      | 75     | +15     |
| Social Proof & Trust      | 35      | 75     | +40     |
| Prompt Connection         | 45      | 85     | +40     |

---

## Phase 1: Quick Wins (Days 1-3)

_Highest impact, lowest effort_

### Day 1: Clear CTA Button

**Effort:** 30 minutes | **Impact:** HIGH

- [ ] Add prominent "Try Prompt Builder" or "Start Creating" button
- [ ] Position above the fold, high contrast
- [ ] Secondary CTA: "See Pro Features"
- [ ] Make user journey clear: Browse data → Pick provider → Build prompt → Create

**Acceptance:** Button visible within 2 seconds of page load, clicks through to `/prompts/playground` or similar

---

### Day 2: Concrete Tagline

**Effort:** 10 minutes | **Impact:** HIGH

**Current (confusing):**

> "A bridge between markets and imagination"
> "Track what's happening out there, then turn those movements into prompts, content and tools in here."

**Target (concrete):**

> "Real-time market data to inspire AI-generated content"

- [ ] Rewrite hero tagline to explain WHAT Promagen does
- [ ] Add 3 quick use-cases above the fold:
  - "Market surging? Generate bold, energetic visuals"
  - "Volatility rising? Craft dramatic, intense prompts"
  - "Markets calm? Create serene, minimal content"

**Acceptance:** A first-time visitor understands what Promagen does within 5 seconds

---

### Day 3: "What is Promagen?" Section

**Effort:** 1 hour | **Impact:** MEDIUM-HIGH

- [ ] Add explainer section below hero
- [ ] Show before/after: market data → generated content example
- [ ] Visual: FX ribbon snapshot → arrow → AI image/prompt output
- [ ] Keep it brief: 3 sentences max + 1 visual

**Acceptance:** The "aha moment" is visible without scrolling past first viewport

---

## Phase 2: Navigation & Discovery (Days 4-6)

### Day 4: Visible Navigation Bar

**Effort:** 2 hours | **Impact:** HIGH

**Problem:** Hidden depth — these routes exist but aren't discoverable:

- `/prompts/explore`, `/prompts/library`, `/prompts/playground`
- `/providers/leaderboard`, `/providers/compare`
- `/pro-promagen`
- `/macro`, `/status`

**Fix:**

- [ ] Add visible nav bar (not just "PROMAGEN" label)
- [ ] Group features: **Markets | Prompts | Providers | Pro**
- [ ] Responsive: collapses to hamburger on mobile

**Acceptance:** All major sections reachable in 1 click from homepage

---

### Day 5: Footer with Sitemap

**Effort:** 1 hour | **Impact:** MEDIUM

- [ ] Create footer component with grouped links
- [ ] Columns: Product | Resources | Company | Legal
- [ ] Include all discoverable routes
- [ ] Data source attribution (TwelveData, Marketstack logos)

**Acceptance:** Footer present on all pages, all routes linked

---

### Day 6: Information Architecture Review

**Effort:** 30 minutes | **Impact:** MEDIUM

- [ ] Audit current routes vs navigation
- [ ] Ensure consistent naming (nav labels match page titles)
- [ ] Add breadcrumbs where depth > 1

---

## Phase 3: Visual Hierarchy (Days 7-10)

### Day 7: Hero Focus

**Effort:** 2 hours | **Impact:** HIGH

**Problem:** Too much competing for attention:

- 3 finance ribbons stacked
- 2 exchange rails with 16 cards
- AI providers leaderboard
- Everything is "equally important"

**Fix:**

- [ ] Make ONE element the hero (recommendation: FX ribbon + CTA)
- [ ] Push secondary content below fold
- [ ] Consider tabs for ribbons instead of vertical stacking

---

### Day 8: Exchange Cards Reduction

**Effort:** 1 hour | **Impact:** MEDIUM

- [ ] Reduce visible exchange cards (8 instead of 16)
- [ ] Add "Show all exchanges" expansion
- [ ] Preserve rail scrolling behaviour

---

### Day 9-10: Market → Prompt Connection (CRITICAL)

**Effort:** 2-3 hours | **Impact:** VERY HIGH

**Problem:** Homepage shows market data but doesn't show WHY it matters for prompts.

**Hidden features that should be visible:**

- Market mood → prompt suggestions
- Conflict detection
- Smart reordering
- WorldPrompt concept

**Fix:**

- [ ] Add "Market Mood" indicator on homepage (e.g., ⚡ Energetic, 🌊 Calm, 🔥 Volatile)
- [ ] Show sample: "Current mood: ⚡ Energetic → Try bold colors, dramatic lighting"
- [ ] Link market data to prompt suggestions visibly
- [ ] Consider: small "Suggested prompt style" card next to FX ribbon

**Acceptance:** Visitor immediately sees the market-to-creativity connection

---

## Phase 4: Polish & Trust (Days 11-15)

### Day 11: Empty States & Loading

**Effort:** 1-2 hours | **Impact:** MEDIUM

**Current issues:**

- "···" for missing data is cryptic
- Weather shows "—" without explanation

**Fix:**

- [ ] Replace "···" with "Loading..." or shimmer animation
- [ ] Add tooltips: "Weather unavailable" vs just "—"
- [ ] Graceful degradation: "FX data will refresh at :30"

---

### Day 12-13: Social Proof

**Effort:** 2-3 hours | **Impact:** HIGH

**Current:** No evidence the product is real or trusted

**Fix:**

- [ ] Show usage stats: "X prompts created" or "X users exploring"
- [ ] Add brief testimonial quotes (or placeholder for future)
- [ ] Display data source attribution prominently
- [ ] Consider: "Powered by TwelveData" badge near ribbons

---

### Day 14-15: Mobile Experience

**Effort:** 3-4 hours | **Impact:** MEDIUM

**Current issues:**

- Three-column layout stacks = very tall page
- No hamburger menu
- Ribbons take significant vertical space

**Fix:**

- [ ] Hide one exchange rail on mobile (show nearest exchanges only)
- [ ] Collapse ribbons into swipeable carousel
- [ ] Add bottom navigation bar for mobile
- [ ] Test on actual device

---

## Phase 5: Delight (Days 16-20)

### Day 16-17: "Aha Moment" Demo Flow

**Effort:** 3-4 hours | **Impact:** VERY HIGH

- [ ] Create interactive walkthrough: "See how it works"
- [ ] 3-step demo: Pick market mood → Choose provider → Generate prompt
- [ ] Optional: auto-play gentle animation on first visit

---

### Day 18-19: WorldPrompt Preview

**Effort:** 2-3 hours | **Impact:** HIGH

- [ ] Surface WorldPrompt concept on homepage
- [ ] Show how location + weather + market = unique prompt context
- [ ] Tease as Pro feature if applicable

---

### Day 20: Final Review & Polish

- [ ] Full user journey test (new visitor perspective)
- [ ] Performance audit (Core Web Vitals)
- [ ] Accessibility pass (keyboard nav, screen reader)
- [ ] Re-score against original criteria

---

## Progress Tracker

| Phase                     | Days  | Status         | Score Impact |
| ------------------------- | ----- | -------------- | ------------ |
| Phase 1: Quick Wins       | 1-3   | ⬜ Not Started | +8           |
| Phase 2: Navigation       | 4-6   | ⬜ Not Started | +5           |
| Phase 3: Visual Hierarchy | 7-10  | ⬜ Not Started | +7           |
| Phase 4: Polish & Trust   | 11-15 | ⬜ Not Started | +5           |
| Phase 5: Delight          | 16-20 | ⬜ Not Started | +5           |

**Projected Final Score:** 72 + 30 = **102** (capped at realistic **88-92**)

---

## Key Principles

1. **Show, don't tell** — Demonstrate the market → prompt magic visually
2. **One hero at a time** — Reduce cognitive load, guide the eye
3. **Clear journey** — Every page should have ONE obvious next step
4. **Trust signals** — Real data sources, real usage, real value

---

## Notes & Decisions Log

_Track decisions made during implementation:_

| Date | Decision | Rationale |
| ---- | -------- | --------- |
|      |          |           |

---

## Reference Links

- Current homepage: `src/app/page.tsx`
- Prompt Builder: `/prompts/playground`
- Providers: `/providers/leaderboard`
- Pro features: `/pro-promagen`
- WorldPrompt: `src/app/components/WorldPrompt/` (if exists)

---

_Last updated: January 2026_
