# Phase 4 End-to-End Test Checklist

**Date:** 25 February 2026  
**Scope:** Full user journey: Scene → modify → Explore → copy, per tier  
**Authority:** prompt-builder-evolution-plan-v2.md § Phase 4, Step 4.7

---

## How to Use

Run through each numbered test manually in the browser. Mark ✅ or ❌. Each test specifies the setup (which provider/tier to use) and expected behaviour.

---

## Pre-Test Setup

1. Open any provider prompt builder page (e.g. `/providers/leonardo`)
2. Open browser DevTools → Console (for analytics verification)
3. Set `NEXT_PUBLIC_ANALYTICS_DEBUG=true` in `.env.local` if not already set
4. Have accounts ready: anonymous (incognito), free signed-in, pro signed-in

---

## A. Scene Starters — Core Flow

| # | Test | Setup | Steps | Expected | ✅/❌ |
|---|------|-------|-------|----------|------|
| A1 | Scene strip collapsed by default | Any provider | Load page | "🎬 Scene Starters ▾" visible between instructions and category grid, collapsed | |
| A2 | Expand scene strip | Any provider | Click trigger bar | World pills appear, scene cards visible | |
| A3 | Free scene applies prefills | Leonardo (Tier 1) | Click "Dramatic Portrait" (free) | 5–7 categories populated with themed values | |
| A4 | Active scene indicator | After A3 | Observe | Cyan tint on active card, "✕ Clear scene" in header | |
| A5 | Scene-origin chip tinting | After A3 | Check combobox chips | Scene-applied chips have cyan tint + 🎬 indicator | |
| A6 | Modification tracking | After A3 | Change any scene value manually, then click another scene | Confirmation dialog appears: "You've modified scene values. Apply new scene?" | |
| A7 | Confirm reset | After A6 | Click "Apply" in dialog | New scene applied, old values cleared | |
| A8 | Cancel reset | After A6 | Click "Cancel" in dialog | Previous scene values preserved | |
| A9 | Clear scene | After A3 | Click "✕ Clear scene" | All categories cleared, no active scene | |
| A10 | Tier 4 reduced prefills | Switch to Artistly (Tier 4) | Apply any scene | Only 3–5 categories prefilled (not all), amber "⚡ reduced" label visible | |
| A11 | Affinity dots | Any provider | Expand scene strip | Cards show colour dots: 🟢 (≥8), 🟡 (6–7), 🔴 (<6) matching tier affinity | |

## B. Scene Starters — Pro Gate

| # | Test | Setup | Steps | Expected | ✅/❌ |
|---|------|-------|-------|----------|------|
| B1 | Pro scenes visible but locked | Any provider, free user | Expand scene strip, switch to pro world | Pro scenes show 🔒 icon + 50% opacity | |
| B2 | Anonymous clicks pro scene | Incognito browser | Click locked pro scene | "Sign in first" dialog with Clerk sign-in button | |
| B3 | Free user clicks pro scene | Free signed-in user | Click locked pro scene | "Upgrade to Pro" dialog with link to `/pro-promagen` | |
| B4 | Pro user full access | Pro signed-in user | Expand scene strip | All 200 scenes accessible, no locks | |
| B5 | World pills — free first | Any user | Expand scene strip | Free worlds appear left of divider, pro worlds right | |

## C. Explore Drawer — Core Flow

| # | Test | Setup | Steps | Expected | ✅/❌ |
|---|------|-------|-------|----------|------|
| C1 | Trigger bar visible | Any provider | Look below each category dropdown | "Explore N more phrases ▾" visible | |
| C2 | Expand drawer | Any provider | Click trigger bar for Style | Search input + source tabs + chip cloud appear | |
| C3 | Tab filtering | After C2 | Click "🌤️ Weather" tab | Only weather-sourced phrases shown | |
| C4 | Click chip to add | After C2 | Click any chip | Chip disappears from drawer, appears in dropdown selection | |
| C5 | Fill to max | Tier 4 provider, Style (limit 1) | Select 1 style | Remaining chips show disabled state (muted, cursor-not-allowed) | |
| C6 | Search filtering | After C2, reset | Type "golden" in search | Chips filter to matches, "golden" highlighted in each chip | |
| C7 | Clear search | After C6 | Click ✕ in search box | All chips return, search cleared | |
| C8 | Pagination | After C2 | Scroll to bottom | "Show 60 more (N left)" button visible | |
| C9 | Show more | After C8 | Click "Show 60 more" | Next 60 chips load | |
| C10 | Accordion behaviour | After C2 | Click trigger for Lighting | Style drawer closes, Lighting drawer opens | |
| C11 | Escape closes | After C2 | Press Escape key | Drawer collapses | |
| C12 | No tabs for core-only categories | Any provider | Open drawer for Camera or Fidelity | No tab bar (only core vocab, no merged sources) | |
| C13 | Environment large count | Any provider | Open drawer for Environment | Shows ~2,600 terms, paginated | |

## D. Explore Drawer — Phase 4 Features

| # | Test | Setup | Steps | Expected | ✅/❌ |
|---|------|-------|-------|----------|------|
| D1 | Scene flavour tab | Apply "Dramatic Portrait" scene | Open Lighting drawer | "🎬 Scene (2)" tab appears FIRST in tab row | |
| D2 | Scene flavour tab — cyan styling | After D1 | Click "🎬 Scene" tab | Tab has cyan tint when active (not blue like other tabs) | |
| D3 | Scene flavour chips | After D2 | Observe chip cloud | Chips have cyan border + 🎬 prefix, distinct from core chips | |
| D4 | Scene flavour count in trigger | After D1 (collapsed) | Read trigger bar | Shows "Explore N more phrases + 2 scene" | |
| D5 | No scene tab without scene | Clear scene | Open any drawer | No "🎬 Scene" tab visible | |
| D6 | No scene tab without flavour | Apply a scene WITHOUT flavourPhrases | Open any drawer | No "🎬 Scene" tab (scene has no bonus phrases for this category) | |

## E. Tier Badges (All 4 Tiers)

| # | Test | Setup | Steps | Expected | ✅/❌ |
|---|------|-------|-------|----------|------|
| E1 | Tier 1 badges | Leonardo (Tier 1) | Open any Explore drawer | ★ badges on 1–2 word chips (token-efficient indicator) | |
| E2 | Tier 2 badges | Midjourney (Tier 2) | Open any Explore drawer | ◆ badges on 2–4 word chips (keyword-optimised indicator) | |
| E3 | Tier 3 badges | DALL-E (Tier 3) | Open any Explore drawer | 💬 badges on 3+ word chips (descriptive-friendly indicator) | |
| E4 | Tier 4 badges | Artistly (Tier 4) | Open any Explore drawer | ⚡ on 1–2 word chips, ⚠ on 3+ word chips | |
| E5 | Badge tooltips | Any tier | Hover over badged chip | Tooltip explains tier-specific meaning | |
| E6 | Platform switch rebadges | Switch from Leonardo to Artistly | Observe open drawer | Badges change from ★ to ⚡/⚠ | |

## F. Cascade Relevance Ordering

| # | Test | Setup | Steps | Expected | ✅/❌ |
|---|------|-------|-------|----------|------|
| F1 | Default sort is alphabetical | No selections | Open Lighting drawer | Chips sorted A–Z | |
| F2 | Cascade reorders chips | Select "oil painting" in Style | Open Lighting drawer | Chips related to oil painting (e.g. "warm studio light") appear earlier than before | |
| F3 | Scene tab unaffected | Apply scene + select values | Open drawer, click Scene tab | Scene chips still in original order (not reordered by cascade) | |

## G. Analytics Events (GTM DataLayer)

| # | Test | Setup | Steps | Expected in Console | ✅/❌ |
|---|------|-------|-------|---------------------|------|
| G1 | scene_selected | Any provider | Apply a free scene | `{event: 'scene_selected', scene_id, scene_name, world, tier, platform_tier, categories_prefilled}` | |
| G2 | scene_reset | After G1 | Click "✕ Clear scene" | `{event: 'scene_reset', scene_id, was_modified}` | |
| G3 | explore_drawer_opened | Any provider | Expand any Explore drawer | `{event: 'explore_drawer_opened', category, platform_tier}` | |
| G4 | explore_chip_clicked | After G3 | Click any chip | `{event: 'explore_chip_clicked', category, term, platform_tier, source_tab}` | |
| G5 | cascade_reorder_triggered | Select values in 2+ categories | Observe (automatic) | `{event: 'cascade_reorder_triggered', categories_reordered, elapsed_ms}` | |
| G6 | No duplicate drawer_opened | Collapse then re-expand same drawer | Check console | Only 1 event per expand (not on collapse) | |

## H. Full User Journey (Happy Path)

| # | Test | Steps | Expected | ✅/❌ |
|---|------|-------|----------|------|
| H1 | Scene → Explore → Copy | 1. Open Leonardo. 2. Apply "Fantasy Hero" scene. 3. Open Lighting drawer. 4. Click "🎬 Scene" tab. 5. Add a flavour phrase. 6. Open Environment drawer. 7. Search "forest". 8. Add a chip. 9. Copy prompt. | Prompt contains scene prefills + manually added terms. Output optimised for Tier 1 (CLIP format). | |
| H2 | Scene → Switch platform → Copy | 1. Apply scene on Leonardo (Tier 1). 2. Switch to Artistly (Tier 4). 3. Observe auto-trim. 4. Copy prompt. | Excess selections trimmed. Tier 4 badges now shown. Output in plain language format. | |
| H3 | Explore → Fill max → Switch category | 1. Open Style drawer on Tier 4 (limit 1). 2. Click a chip. 3. Chips disable. 4. Open Lighting drawer. 5. Confirm Style drawer closed. | Accordion works, max-fill disabling works. | |

---

## Test Coverage Summary

| Area | Tests | Description |
|------|-------|-------------|
| Scene Starters Core | A1–A11 | Apply, clear, modify, tier 4 reduction, affinity |
| Scene Pro Gate | B1–B5 | Lock states, upgrade prompts, world ordering |
| Explore Drawer Core | C1–C13 | Expand, tabs, chips, search, pagination, accordion |
| Explore Phase 4 | D1–D6 | Scene flavour tab, cyan styling, trigger count |
| Tier Badges | E1–E6 | All 4 tiers, tooltips, platform switch |
| Cascade Ordering | F1–F3 | Default sort, cascade reorder, scene exclusion |
| Analytics | G1–G6 | All 5 events, no duplicates |
| Full Journey | H1–H3 | End-to-end happy paths |

**Total tests: 44**
