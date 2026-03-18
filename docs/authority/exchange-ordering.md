# Exchange Ordering — Tiered Reference Frame System

**Last updated:** 18 March 2026
**Version:** 1.0.0
**Owner:** Promagen
**Status:** Specification — Not Yet Implemented
**Authority:** This document defines the exchange ordering behaviour across all three user tiers. Supersedes the fixed east-to-west ordering in `lib/exchange-order.ts` once implemented.

---

## 1. Executive Summary

Exchange cards on the homepage and World Context page are currently ordered east-to-west by longitude, anchored to the Greenwich Meridian (UTC). This spec introduces a tiered ordering system where Pro users get their local timezone as the reference point — the entire exchange rail reorders around *them*.

The ordering system is a **selling point for Pro**, not a punishment for free users. All tiers see a clean, logical layout. Pro users get personalisation.

---

## 2. Three-Tier Ordering

| Tier | Order | Reference Point | Anchor | What the User Feels |
|------|-------|----------------|--------|---------------------|
| **Anonymous** | East → West | Greenwich (UTC) | `longitude desc` | "This is clean and logical — times flow naturally" |
| **Signed-in (Free)** | East → West | Greenwich (UTC) | `longitude desc` | Same view — upgrade path is prompts, saving, scenes |
| **Pro Promagen** | East → West | **User's location** | `longitude desc` relative to user | "Everything starts from me — my market is at the top" |

**Critical principle:** Anonymous and free users see the *same* ordering. We never degrade the free experience to sell Pro. The free layout is already good — clean east-to-west, times descending naturally. Pro adds personalisation on top of an already-good baseline.

---

## 3. How Pro Ordering Works

### 3.1 The Shift

When a Pro user loads the page, their browser's timezone (via `Intl.DateTimeFormat().resolvedOptions().timeZone`) determines a reference longitude. All exchanges are then sorted east-to-west *starting from that longitude*, wrapping around the globe.

**Example — Pro user in Tokyo (longitude 139.7):**

```
Standard (Greenwich):  NZX → ASX → TSE → HKEX → BSE → EGX → JSE → LSE → NYSE → B3
Pro (Tokyo anchor):    TSE → HKEX → BSE → EGX → JSE → LSE → NYSE → B3 → NZX → ASX
                       ↑                                                           ↑
                       User's local market first              Wraps back to east of them
```

The user's nearest exchange sits at the top-left. The trading day flows westward from them, wrapping around to the exchanges just east of them (which closed most recently in their "yesterday").

**Example — Pro user in New York (longitude -74.0):**

```
Pro (NY anchor):       NYSE → B3 → NZX → ASX → TSE → HKEX → BSE → EGX → JSE → LSE
                       ↑                                                           ↑
                       User's local market first              European markets end the cycle
```

### 3.2 The Algorithm

```typescript
function sortExchangesForUser(
  exchanges: Exchange[],
  userLongitude: number,
): Exchange[] {
  // 1. Sort all exchanges east-to-west (standard)
  const sorted = exchanges.slice().sort((a, b) => b.longitude - a.longitude);

  // 2. Find the first exchange east of or at the user's longitude
  //    (the one closest to "just east of me" — my market or the one ahead of me)
  const splitIdx = sorted.findIndex((e) => e.longitude <= userLongitude);

  // 3. Rotate: everything from splitIdx onward comes first, then wrap
  if (splitIdx <= 0) return sorted; // User is further east than all exchanges
  return [...sorted.slice(splitIdx), ...sorted.slice(0, splitIdx)];
}
```

This is a simple array rotation — no new sort logic, no timezone parsing, no API calls. The existing `sortEastToWest()` runs first, then we rotate the result.

### 3.3 Obtaining User Longitude

**Source:** The browser's timezone IANA name (e.g., `Asia/Tokyo`) maps to a representative longitude via a static lookup table. We do NOT use the Geolocation API (requires permission prompt, kills UX).

```typescript
// Static timezone → longitude mapping (representative city per zone)
const TZ_LONGITUDES: Record<string, number> = {
  'Pacific/Auckland': 174.8,
  'Australia/Sydney': 151.2,
  'Asia/Tokyo': 139.7,
  'Asia/Hong_Kong': 114.2,
  'Asia/Singapore': 103.8,
  'Asia/Kolkata': 72.9,
  'Asia/Dubai': 55.3,
  'Africa/Johannesburg': 28.0,
  'Africa/Cairo': 31.2,
  'Europe/Istanbul': 29.0,
  'Europe/Moscow': 37.6,
  'Europe/Helsinki': 24.9,
  'Europe/Berlin': 13.4,
  'Europe/Paris': 2.3,
  'Europe/London': -0.1,
  'America/Sao_Paulo': -46.6,
  'America/New_York': -74.0,
  'America/Chicago': -87.6,
  'America/Denver': -104.9,
  'America/Los_Angeles': -118.2,
  'America/Anchorage': -149.9,
  'Pacific/Honolulu': -155.5,
  // ... exhaustive list derived from IANA tz database
};

function getUserLongitude(): number | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_LONGITUDES[tz] ?? null;
  } catch {
    return null;
  }
}
```

**Fallback:** If the timezone isn't in the lookup, or if `Intl` is unavailable, fall back to Greenwich ordering (longitude 0). The user still sees a clean layout — they just don't get the personalised anchor.

---

## 4. Rail Split Behaviour

The homepage splits exchanges into left and right rails (see `lib/exchange-order.ts`). This split logic is **unchanged** — it always takes the ordered array, splits at the midpoint, and reverses the right rail for visual symmetry.

| Tier | Input to rail split | Result |
|------|-------------------|--------|
| Anonymous/Free | `sortEastToWest(selected)` | Standard layout |
| Pro | `sortExchangesForUser(sortEastToWest(selected), userLong)` | Rotated layout |

The `getRailsForHomepage()` function gains an optional `userLongitude` parameter. When `null` or `undefined`, it behaves identically to today.

---

## 5. Reference Frame Toggle Integration

The existing Reference Frame Toggle (`src/components/reference-frame-toggle.tsx`) currently switches between `'user'` and `'greenwich'` frames for *time display*. This spec extends it to also control *exchange ordering*.

| Frame | Time display | Exchange order |
|-------|-------------|----------------|
| `'greenwich'` | UTC reference | East → West from Greenwich |
| `'user'` | Local reference | East → West from user's location |

**Pro users** get the toggle. When they switch frames, both the time displays AND the exchange order update simultaneously. The rail re-renders with a smooth reorder animation (see §7).

**Free/anonymous users** see the toggle locked or hidden — same as today. No change to their experience.

---

## 6. Data Flow

### 6.1 Anonymous / Free

```
Page load
  → loadSelectedExchanges()
  → sortEastToWest(exchanges)        // longitude desc
  → splitIntoRails(ordered)
  → render left rail + right rail
```

No change from current behaviour.

### 6.2 Pro User

```
Page load
  → loadSelectedExchanges()           // from Clerk metadata (user's selection)
  → sortEastToWest(exchanges)         // longitude desc (standard base)
  → getUserLongitude()                // from Intl.DateTimeFormat
  → sortExchangesForUser(ordered, userLong)  // rotate array
  → splitIntoRails(rotated)
  → render left rail + right rail
```

### 6.3 Pro User Toggles to Greenwich

```
Toggle click (user → greenwich)
  → sortEastToWest(exchanges)         // back to standard
  → splitIntoRails(ordered)
  → animate reorder
  → render
```

---

## 7. First-Login Animation (Deferred — Phase 2)

On a Pro user's **first visit after upgrading**, the exchanges load in Greenwich order (the layout they're used to), hold for 1.5 seconds, then smoothly reorder to their local anchor. Each card slides to its new position over 600ms with staggered delays (40ms × index).

**Implementation:** CSS `transition: transform 600ms ease-out` on each card. Calculate the pixel offset between old and new positions, apply `translateY` for the transition, then remove transforms.

**Trigger:** `clerk.user.publicMetadata.hasSeenProReorder` flag. Set to `true` after the animation completes. Subsequent visits load directly in user-anchored order.

This is a "wow moment" — it communicates "everything just became about you" more powerfully than any text. Deferred to Phase 2 to keep Phase 1 simple.

---

## 8. File Changes (Phase 1)

| File | Change |
|------|--------|
| `src/lib/exchange-order.ts` | Add `sortExchangesForUser()`, add optional `userLongitude` param to `getRailsForHomepage()` |
| `src/lib/geo/tz-longitudes.ts` | **NEW** — static timezone → longitude lookup table |
| `src/hooks/use-exchange-order.ts` | **NEW** — hook that combines auth state + timezone detection + ordering logic |
| `src/components/reference-frame-toggle.tsx` | Extend to dispatch exchange reorder on toggle (Pro only) |
| `src/components/home/homepage-grid.tsx` | Consume hook instead of calling `getRailsForHomepage()` directly |
| `src/app/pro-promagen/pro-promagen-client.tsx` | Pro page preview uses user-anchored ordering |
| `docs/authority/paid_tier.md` | Add §5.x documenting Pro exchange ordering |

### 8.1 New Hook: `useExchangeOrder`

```typescript
function useExchangeOrder(): {
  left: Exchange[];
  right: Exchange[];
  referenceLabel: string;  // "Greenwich" | "Tokyo" | "New York" etc.
} {
  const { isPaidUser } = usePromagenAuth();
  const { referenceFrame } = useReferenceFrame();

  // Free/anon: always Greenwich
  if (!isPaidUser || referenceFrame === 'greenwich') {
    return { ...getRailsForHomepage(), referenceLabel: 'Greenwich' };
  }

  // Pro + user frame: rotate to user's longitude
  const userLong = getUserLongitude();
  if (userLong === null) {
    return { ...getRailsForHomepage(), referenceLabel: 'Greenwich' };
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cityName = tz.split('/').pop()?.replace(/_/g, ' ') ?? 'Your Location';

  return {
    ...getRailsForHomepage(userLong),
    referenceLabel: cityName,
  };
}
```

---

## 9. Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Pro user, unknown timezone | Fall back to Greenwich ordering, show "Greenwich" label |
| Pro user, VPN in different country | Uses browser timezone (not IP), so ordering follows their OS setting |
| Pro user toggles Greenwich → User → Greenwich | Each toggle re-renders rails with smooth transition |
| Pro user with 6 custom exchanges all in same timezone | Ordering still works (secondary sort by exchange name for stability) |
| DST transition | Longitude-based, not UTC-offset-based — DST has zero effect |
| International Date Line | Longitude wrapping handles this (NZX at +174.8 is "most east") |

---

## 10. What This Does NOT Change

- Exchange *selection* (which exchanges appear) — unchanged, still driven by `exchanges.selected.json` for free users and Clerk metadata for Pro
- Weather data fetching — unchanged
- Prompt generation — unchanged (weather data is per-exchange, not per-order)
- Market open/close status — unchanged
- Rail split ratio (ceil/floor) — unchanged
- Mobile behaviour — N/A (desktop only)

---

## 11. Acceptance Criteria

### Phase 1 (Core)

- [ ] Anonymous users see exchanges in east-to-west Greenwich order (same as today)
- [ ] Free signed-in users see exchanges in east-to-west Greenwich order (same as today)
- [ ] Pro users see exchanges anchored to their local timezone by default
- [ ] Pro user's nearest exchange appears at top-left of left rail
- [ ] Reference Frame Toggle switches between Greenwich and user-local ordering
- [ ] Toggle transition is smooth (no layout jump)
- [ ] Unknown timezone falls back to Greenwich silently
- [ ] `useExchangeOrder` hook passes typecheck
- [ ] Existing exchange ordering tests still pass
- [ ] New tests: Pro ordering for Tokyo, New York, London, Sydney anchors

### Phase 2 (Deferred)

- [ ] First-login animation: Greenwich → user-local reorder with staggered card slides
- [ ] `hasSeenProReorder` flag in Clerk metadata
- [ ] Animation respects `prefers-reduced-motion`

---

## 12. Human Factors

**Personalisation as ownership (Endowment Effect):** When the exchange rail starts from *your* market, the whole product feels like it was built for you. You're not using a generic tool — you're using *your* Promagen.

**Temporal compression (§6 of human-factors.md):** A Tokyo user sees TSE at the top with their local time. The trading day flows *away* from them westward. This creates a natural narrative: "my morning, then Hong Kong's morning, then India, then Europe wakes up, then America." The user is at the centre of the world's rotation — exactly the philosophy in `worldprompt-creative-engine.md` §1.2.

**Zero-degradation upgrade path:** Free users never see a broken or ugly layout. Their experience is already clean. Pro adds personalisation — it doesn't fix something that was deliberately broken.

---

## 13. References

| Document | Relevance |
|----------|-----------|
| `lib/exchange-order.ts` | Current ordering implementation (to be extended) |
| `worldprompt-creative-engine.md` §1.2 | Sun-following metaphor, east-to-west philosophy |
| `paid_tier.md` §5.10 | Reference Frame toggle documentation |
| `human-factors.md` §6 | Temporal compression, Endowment Effect |
| `gallery-mode-master.md` §3.2 | East-to-west rotation mode (same concept, different surface) |
| `code-standard.md` §6.0 | clamp() sizing, cursor-pointer, no grey |

---

## Changelog

- **18 Mar 2026 (v1.0.0):** Initial specification. Three-tier ordering system: Anonymous/Free = Greenwich east-to-west (unchanged), Pro = user-location-anchored east-to-west. Algorithm: simple array rotation of longitude-sorted list. No Geolocation API — uses Intl timezone → static longitude lookup. Reference Frame Toggle extended to control both time display and exchange order. First-login animation deferred to Phase 2.
