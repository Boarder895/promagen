# Gallery Mode v2.1.0 Documentation Updates

**Date:** 19 January 2026  
**Scope:** Comprehensive documentation updates for Gallery Mode v2.1.0  
**Authority:** This document summarizes all changes made to Promagen documentation.

---

## Documents Updated

| Document | Section(s) Added/Updated | Summary |
|----------|-------------------------|---------|
| `ai_providers.md` | §AI Provider Selector | New section for Pro-only provider filtering with alphabetical sort, 123rf-last placement, Gallery Mode 1-3 limit |
| `paid_tier.md` | §5.12 Gallery Mode | Complete Pro feature specification: world tour, AI generation, prompts, library, costs |
| `prompt-intelligence.md` | §4.5 Gallery Mode Integration | How market moods and semantic tags power automatic prompt generation |
| `ARCHITECTURE.md` | §Gallery Mode Architecture | System diagrams, data flow, API endpoints, file structure |

---

## Key Features Documented

### 1. Weather API (90% Built)
- Visual Crossing integration exists
- Demo mode working, live mode needs env vars
- Cost: $0/month (free tier sufficient)
- Enable with: `WEATHER_MODE=live` + `VISUAL_CROSSING_API_KEY`

### 2. Market Mood Engine (Data Ready)
- 11 mood types defined in `market-moods.json`
- All data sources exist (`/api/fx`, `/api/crypto`, `/api/commodities`)
- Detection logic needed: evaluate triggers, return active mood

### 3. AI Provider Selector (New)
- Pro-only dropdown above Providers Table
- Alphabetical sort with 123rf always last
- Gallery Mode: 1-3 providers max
- Providers View: unlimited selection
- Persistence: localStorage + Clerk metadata

### 4. Gallery Mode Core
- 79 exchange world tour (10-min cadence)
- AI image generation per city
- 4-tier prompt variants with copy buttons
- Screensaver mode for ambient viewing
- Image library with full metadata

---

## File Changes Summary

### New Sections in ai_providers.md

```markdown
## AI Provider Selector (v2.1.0 — NEW)

### Overview
Pro Promagen users can filter the AI Providers leaderboard...

### Sort Order Logic
Alphabetical A-Z, with 123rf always last...

### Selection Limits
| Context | Max Selections |
|---------|----------------|
| Gallery Mode | 1–3 |
| Providers View | Unlimited |

### Persistence
localStorage + Clerk metadata sync...
```

### New Section in paid_tier.md

```markdown
### 5.12 Gallery Mode (Pro Promagen exclusive) — NEW v2.1.0

Gallery Mode transforms Promagen from a "dashboard that shows market data" 
into a "living artefact where the markets literally paint."

- Cycles through 79 exchange cities on 10-minute cadence
- Generates AI images reflecting city mood, time, season, market sentiment
- Exposes 4 prompt variants (one per AI provider tier)
- Full image library with reproducibility metadata
- AI Provider Selector for filtering (1-3 in Gallery)
```

### New Section in prompt-intelligence.md

```markdown
## 4.5 Gallery Mode Integration (NEW v2.1.0)

The Prompt Intelligence system powers Gallery Mode's automatic prompt generation.

### How Gallery Mode Uses Prompt Intelligence
- CitySnapshot → Scene Brief pipeline
- Market Mood → Prompt influence
- Weather → Atmosphere mapping
- 4-tier prompt rendering
- Caps enforcement and conflict avoidance
```

### New Section in ARCHITECTURE.md

```markdown
## Gallery Mode Architecture (NEW v2.1.0)

### System Overview
Rotation Engine → Theme Engine → Prompt Builder → Generator → Storage → Display

### Data Flow
- Image generated every 10 minutes (144/day)
- Consumes FX, Crypto, Commodities, Weather data
- Market Mood detection priority

### File Structure
frontend/src/lib/gallery/ — All Gallery Mode logic
frontend/src/components/gallery/ — UI components
frontend/src/app/api/gallery/ — API endpoints
```

---

## Implementation Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| **Phase 1** | 2-3 weeks | MVP: Rotation → Theme → Prompt → Generate → Display |
| **Phase 2** | 1 week | Weather + Market Mood Engine |
| **Phase 3** | 1 week | AI Provider Selector |
| **Phase 4** | 1 week | Library + Polish |

**Total:** 5-6 weeks

---

## Cost Analysis

| Component | Monthly Cost |
|-----------|--------------|
| DALL·E 3 (144 images/day) | ~$173 |
| R2 Storage | $0 (free tier) |
| Weather API | $0 (free tier) |
| **Total** | **~$175/month** |

**Break-even:** 20 Pro subscribers at $9/month

---

## Cross-References Updated

| Document | New References |
|----------|----------------|
| ai_providers.md | → gallery-mode-master.md §16 |
| paid_tier.md | → gallery-mode-master.md |
| prompt-intelligence.md | → gallery-mode-master.md |
| ARCHITECTURE.md | → Gallery Mode system diagrams |

---

## Changelog Entries Added

### ai_providers.md
```
- **19 Jan 2026:** Added AI Provider Selector section. Documented alphabetical 
  sort with 123rf last, Gallery Mode 1-3 limit, Pro gating, localStorage/Clerk 
  persistence. Added 4-Tier Prompt System for Gallery Mode. Cross-referenced 
  Gallery Mode master spec.
```

### paid_tier.md
```
- **19 Jan 2026:** **GALLERY MODE** — Added §5.12 Gallery Mode (Pro exclusive). 
  79-exchange world tour with 10-minute cadence, AI-generated city images, 
  4-tier prompt variants with copy buttons, image library, screensaver mode. 
  Added AI Provider Selector (1-3 max in Gallery). Added weather API and market 
  mood engine integration. Cost analysis: ~$175/month. Authority: gallery-mode-master.md
```

### prompt-intelligence.md
```
- **19 Jan 2026:** Added §4.5 Gallery Mode Integration. Documented how market 
  moods, semantic tags, and 4-tier system power automatic prompt generation. 
  Added CitySnapshot → Scene Brief pipeline, weather-to-atmosphere mapping, 
  caps enforcement, conflict avoidance. Authority: gallery-mode-master.md
```

### ARCHITECTURE.md
```
- **19 Jan 2026:** Added Gallery Mode Architecture section. System diagrams, 
  data flow (10-minute rotation, 144 images/day), API endpoints, file structure, 
  storage architecture (R2 + Postgres), cost control, caching strategy. 
  Authority: gallery-mode-master.md
```

---

## Quick Reference: New Files to Create

| File | Purpose |
|------|---------|
| `src/lib/gallery/rotation-engine.ts` | Playlist + pointer management |
| `src/lib/gallery/theme-engine.ts` | CitySnapshot builder |
| `src/lib/gallery/prompt-builder.ts` | Scene Brief → 4 variants |
| `src/lib/gallery/market-mood-engine.ts` | Live mood detection |
| `src/lib/gallery/weather-integration.ts` | Weather → atmosphere |
| `src/lib/gallery/generator.ts` | DALL·E API + fallback |
| `src/lib/gallery/storage.ts` | R2 + database |
| `src/lib/providers/sort.ts` | Alpha sort, 123rf last |
| `src/lib/providers/filter-prefs.ts` | Selection persistence |
| `src/components/gallery/gallery-toggle.tsx` | Providers/Gallery switch |
| `src/components/gallery/gallery-slideshow.tsx` | Image + crossfade |
| `src/components/providers/provider-filter-selector.tsx` | Dropdown |

---

## Testing Checklist

### Weather API
- [ ] Live mode returns current data
- [ ] Temperatures match real-world
- [ ] Cache working (15-min TTL)
- [ ] Graceful degradation when unavailable

### Provider Selector
- [ ] Free user: No dropdown visible
- [ ] Pro user: Dropdown visible, alphabetical
- [ ] 123rf always last
- [ ] Selection persists on refresh
- [ ] Gallery Mode enforces max 3

### Market Mood Engine
- [ ] Detects market opening/closing
- [ ] Detects gold rising/falling
- [ ] Detects crypto pumping
- [ ] Returns neutral when no signals

---

## Notes

1. **docs-first discipline:** Update docs BEFORE code
2. **SSOT principle:** gallery-mode-master.md is the authority
3. **No demo prices:** Fallback returns null, renders as "—"
4. **Pro gating:** All Gallery features are Pro-only except blurred preview

**Existing features preserved:** Yes
