# **Promagen FX Ribbon — Triple-Diamond Specification (FX-Only)**
*A calm axis of truth and time.*

---

## 1. Narrative Role

The FX ribbon is the quiet heartbeat of Promagen.  
It translates global market rhythm into light — a line where currency relationships breathe, not spin.  
No scrolling tickers, no dancing digits.  
The motion is polite, the data honest, and every shimmer tells the truth of *now*.

Logged-out visitors see a believable, bounded “random walk”: values that drift within limits, never pretending to be live data.  
Logged-in users see genuine hourly snapshots, staggered by design to prevent noise.  
Both see the same visual story — time made visible, calm, and symmetrical.

---

## 2. Placement & Proportion

The ribbon sits directly beneath the homepage header, spanning the horizon between the eastern and western exchange rails.  
It reads **east → west**, mirroring the planet’s financial daylight.

| Viewport | Geometry | Behaviour |
|-----------|-----------|-----------|
| **Desktop ≥ 1024 px** | Stationary, centred row across **80 % width** with 10 % side margins; height ≈ 56 px | No auto-scroll; even gaps (64 px ≥ 1440 px screens; 48 px 1024–1439 px) |
| **Tablet 768–1023 px** | Two balanced rows (3 + 2) if needed; height 52–56 px | Gaps condense → 32–48 px; chips remain optically centred |
| **Mobile ≤ 767 px** | Horizontal swipe gallery with `scroll-snap-align:center`; chip width ≈ 85 % viewport | Edge fades hint continuation; no auto-scroll; height 64–72 px |

When the viewport changes, chips reflow smoothly; nothing jumps.

---

## 3. Content & Eligibility

### Free tier
Fixed **three pairs**:
- EUR / USD  
- GBP / USD  
- GBP / EUR  

Each can be inverted (view-only).  
These are always available, even when logged out.

### Paid tier
Users can choose **up to five** pairs drawn from **currencies present in**  
`frontend/src/data/exchanges.catalog.json`.  
The paid universe may never include a currency not referenced in that catalog.

Selections, favourites, and invert memory persist in:
```
promagen.fxSelections.v2
promagen.fxInvert.<pair>.v1
```

### Source of truth
```
src/data/fx/currencies.catalog.json
src/data/fx.pairs.json
src/data/calendars.catalog.json
src/data/selected/fx.pairs.free.json
src/data/selected/fx.pairs.paid.template.json
```

### Ordering
Each pair inherits an **effective longitude** from its member currencies’ home exchanges.  
Pairs sort east→west before rendering; components never re-sort on the client.

---

## 4. Motion Grammar

**Calm transitions:** 100–150 ms fades, no bounce or elastic easing.  
**Shimmer:** one east→west drift every 180 s (identical timing for FX, Crypto, Commodities, MacroPulse).  
**Pause contract:** one control halts shimmer, timers, and announcements; resume restores all.  
**Reduced motion:** `prefers-reduced-motion` disables every animation; values cross-fade ≤ 300 ms.

**Global design tokens**
```
--ribbon-glow-from
--ribbon-glow-to
--ribbon-duration: 180s
--badge-aging-color: var(--amber-400)
--badge-delayed-color: var(--rose-400)
--motion-fade-duration: 150ms
```
`motion-reduce:!animate-none` must neutralize all motion classes.

---

## 5. Data Presentation Rules

- **Locale:** en-GB.  
- **Numeric style:** tabular-nums; two decimals or pair-specific precision.  
- **Currency:** symbol + number (£ 3,200.87).  
- **As-of stamp:** always visible — “As of HH :mm (local)”.  
- **Logged-out honesty:** simulation stamped and bounded (± 0.2 % per step).  
- **Logged-in:** hourly snapshots, staggered slots, “as of” maintained.

---

## 6. Chip Anatomy

Each chip is a self-contained truth capsule.

| Element | Description |
|----------|--------------|
| **Label** | `BASE / QUOTE`, uppercase, monospaced |
| **Value** | Formatted number, correct precision |
| **Delta signal** | **Single green ▲ only** — shown *next to the strengthening currency*. No dot, no red. |
| **As-of** | Small sub-line or right-aligned text |
| **Invert button (⇄)** | Toggles base/quote; 180° flip ≤ 300 ms; tooltip updates (“View USD per GBP”) |
| **Freshness badge** | “Aging” ≥ 60 min (amber); “Delayed” > 90 min (rose) |
| **Accessibility** | SR text mirrors visuals; colour never sole cue |

### Delta logic (single-state)
```
if current > prevClose + ε:
    show ▲ next to strengthening currency
else:
    show nothing
```
- `ε` ≈ 0.0001 for 5-dp pairs.  
- Arrow computed once after the day’s first update, **stable 24 h**.  
- When inverted, ▲ follows the stronger currency to its new side.  
- SR example: “Pound up since prior close, 1 point 2731, as of 11 : 04.”  
- Silence = not up.

---

## 7. Behavioural Contracts

- **Pause = freeze everything:** shimmer, fetch, random-walk, SR output.  
- **Offline:** values frozen, selections still editable; banner “Offline — updates resume automatically.”  
- **Error budget:** never blank; always last-good + badge.  
- **Max guard:** shared copy “Max 5 pairs — remove one to add another.”  

---

## 8. Accessibility Defaults

- Container `role="region" aria-label="Foreign Exchange Pairs"`.  
- List `role="list"`, items `role="listitem"`.  
- Live region `aria-live="polite" aria-atomic="true"`.  
- Landmarks: rails `role="complementary"`, centre `role="main"`.  
- Keyboard: Tab → chip; Enter → invert; Space → pause; Esc → close popover.  
- Focus ring: consistent sky-400 outline.  
- PRM: all motion stops; values fade.  
- Goal: **Lighthouse Accessibility = 100**.

---

## 9. Interaction & Feedback

- **Toasts:** calm 2–3 s; top-right or inline; handles max-5, data delayed, offline.  
- **Hover details:** rounded 8 px; white/10 ring; neutral-900 background.  
- **Tooltips:** plain language — no marketing verbs.  
- **Geo-spark (optional):** desktop-only hover→provider glow 1 s; cooldown 10 s; disabled under PRM/Pause.

---

## 10. State Memory & Persistence

All localStorage keys share the prefix `promagen.`

| Purpose | Example Key |
|----------|-------------|
| Selections | `promagen.fxSelections.v2` |
| Invert memory | `promagen.fxInvert.eur-usd.v1` |
| Pause state | `promagen.ribbonPaused.v1` |
| One-time hint | `promagen.fxSwipeHint.openOnce.v1=1` |

Favourites (up to 2) share the same structure used later by Crypto & Commodities.

---

## 11. Copy & Tone

Neutral, factual, and SR-parity everywhere.  
No marketing adjectives.  
All times → HH :mm 24-hour (local).  
**Approved strings:**

- Paused — values frozen.  
- Live — updates resumed.  
- Data aging (60 + min).  
- Data delayed (90 + min).  
- Market closed — showing last good value.  
- Invert to {QUOTE}/{BASE}.  
- Max 5 pairs — remove one to add another.

---

## 12. Update Cadence & Staggering

- **Deterministic slot:** `hash(pair.id) % 60` → minute of hour.  
- **Jitter:** ≤ 45 s random delay within minute.  
- **Heartbeat:** UI polls server every 60–180 s; server decides “due” pairs.  
- **Market hours:** `onlyWhenOpen:true` (24×5); closed → greyed tile + “Closed” chip; no polling.  
- **Open pulse:** on session open, immediate refresh + gentle shimmer wake.

---

## 13. Random-Walk vs Live Data

| Mode | Source | Cadence | Range | Honesty |
|------|---------|----------|--------|----------|
| Logged-out | Deterministic sim (`lib/fx/randomwalk.ts`) | 20–30 min | ± 0.2 % per step | Always “As of HH :mm” |
| Logged-in | Real API (`lib/fx/fetch.ts` → `/api/finance/ticker`) | Hourly per slot | N/A | Honest live snapshot |

---

## 14. API Architecture

**Catalogs**
```
data/api.providers.catalog.json
data/api.endpoints.catalog.json
data/api.policies.json
```

**Endpoint:** `/api/finance/ticker`
```json
{ "id": "eur-usd", "value": 1.0924, "prevClose": 1.0876, "asOf": "2025-11-07T09:00:00Z" }
```

**Flow**
1. Select pairs due by slot & open calendar.  
2. Batch fetch (2 per batch / 4 s spacing).  
3. Normalize → `{id,value,prevClose,asOf}`.  
4. Cache SWR TTL ≈ 15 min.  
5. UI consumes normalized TickerItems.  
**Security:** all keys server-side. No raw errors surfaced.  
**Attribution:** footer microtext if required.

---

## 15. Observability & Analytics (20 % sampled)

| Event | Props |
|--------|--------|
| `fx_pause_toggle` | `{ paused, count, offline, latency }` |
| `fx_picker_open` | `{ count, offline }` |
| `fx_apply_pairs` | `{ count, ids }` |
| `fx_invert` | `{ pairId, inverted }` |

No PII ever. Structure only.

---

## 16. Performance Discipline

- One render per scheduled hour per pair max.  
- No polling while closed.  
- Fonts = tabular nums → no layout shift.  
- Target: Lighthouse Performance ≥ 95.

---

## 17. Visual Ecology

Layer interplay forms the **Promagen Tide**:

| Layer | Relationship |
|--------|--------------|
| **Commodities** | Warm metallic wave below; +5 % luminance when fiat strengthens. |
| **Crypto** | Counterflow sparks (west→east) muted when FX active. |
| **Macro Pulse** | Breath lengthens when FX volatile. |

All share: one shimmer system, one badge system, one pause mechanism, one “as-of” component.

---

## 18. Files & Responsibilities

**Components**
```
components/ribbon/finance-ribbon.tsx
components/ribbon/fx-chip.tsx
components/ribbon/mobile-swipe-hint.tsx
components/fx/picker.tsx
components/fx/picker-toggle.tsx
```

**Data**
```
data/exchanges.catalog.json
data/fx/currencies.catalog.json
data/fx.pairs.json
data/calendars.catalog.json
data/selected/fx.pairs.free.json
data/selected/fx.pairs.paid.template.json
```

**Logic**
```
lib/fx/eligibility.ts
lib/fx/selection.store.ts
lib/fx/randomwalk.ts
lib/fx/fetch.ts
lib/fx/compute-daily-arrow.ts
lib/format/number.ts
lib/format/time.ts
lib/net/offline.ts
lib/dom/focus.ts
lib/geo/regions.ts
lib/analytics/index.ts
```

**Styling**
```
app/globals.css   /* shimmer keyframes, tokens, tabular-nums */
```

**Docs**
```
docs/fx-ribbon-standard.md
docs/fx-ribbon-changelog.md
```

---

## 19. Testing & Acceptance

### Unit
- Pairs → valid currencies; precision sane; slot ∈ 0–59.  
- Invert math (1 ÷ rate) rounded correctly.  
- Delta logic → one ▲ only when current > prevClose + ε.

### Integration (Playwright + Axe)
- Renders 3 (free) or ≤ 5 (paid) chips.  
- Invert moves ▲ to correct side.  
- Pause freezes motion and live region.  
- Axe → 0 violations.

### API
- Mock endpoint returns normalized shape.  
- Cache valid SWR; slot timing honoured; closed sessions muted.

### E2E Heartbeat
- Simulated 60 min run → each chip updates once.  
- PRM run → no animations, fades only.  
- Offline run → last-good + delayed badge; no errors.

### Done = Done
✅ 1–5 pairs sorted east→west.  
✅ Green ▲ only, correct side.  
✅ Stationary desktop / swipe mobile.  
✅ Accurate as-of stamps + badges.  
✅ Pause / Play / Invert accessible.  
✅ A11y = 100; Perf ≥ 95.  
✅ All FX currencies derive from exchanges.catalog.json.  
✅ No client secrets.

---

## 20. “Flip API Live” Checklist

1. Implement `fetchFxSnapshot(ids)` in `lib/fx/fetch.ts` → call `/api/finance/ticker`.  
2. Ensure provider returns `prevClose`.  
3. Verify slot hashing and ≤ 45 s jitter.  
4. Respect `forex-24×5` calendar (open/close gates).  
5. Cache SWR ≈ 15 min; badges reflect age.  
6. Run smoke suite (arrow truth, pause, as-of, mobile swipe, SR).  
7. Enable analytics sampling (20 %).  

---

## 21. Documentation Pattern

Every Promagen data ribbon (doc/feature) uses this structure:

**Eligibility / Source of Truth → Ordering Logic → Update Cadence → Pause Contract → Freshness Model → Accessibility Defaults**.  
This FX spec is the template.

---

## 22. Closing Principle

The FX ribbon is not ornament.  
It is Promagen’s axis of truth: slow, precise, and kind to the senses.  
When Crypto and Commodities arrive, they inherit its grammar — one pause button, one shimmer curve, one ethic of honest data.

---

**End of FX Ribbon Triple-Diamond Specification (FX-Only).**  
Next modules: Commodities Bar → Crypto Strip → Macro Pulse.