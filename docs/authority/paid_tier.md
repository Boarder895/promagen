# paid_tier.md — What Is Free and What Is Paid in Promagen

**Status:** Authoritative  
**Scope:** Product behaviour, access rules, and monetisation boundaries  
**Rule:** If a capability is not explicitly listed in this document, it is free.

---

## 1. Core rule (non-negotiable)

**Anything not written in this document is part of Standard Promagen (free).**

There are no implied paywalls.
There are no "soft locks".
There are no hidden tier changes.

`paid_tier.md` is the **exception list**, not the feature catalogue.

---

## 1.1 Terminology

| Term | Definition |
|------|------------|
| **Pro Promagen** | The paid subscription tier. Always use "Pro Promagen" in user-facing text (UI labels, tooltips, CTAs, prompts). Internal code may use `isPaidUser` or `userTier === 'paid'` for brevity. |
| **Standard Promagen** | The free tier. If not explicitly listed in this document, a feature is Standard Promagen. |

**UI usage examples:**
- CTAs: "Upgrade to Pro Promagen"
- Badges: "Pro Promagen" or "Pro"
- Tooltips: "🔒 Pro Promagen Feature"
- Lock messages: "Upgrade to Pro Promagen for unlimited"

**Code usage:**
- Clerk metadata: `{ "tier": "paid" }` (internal, not user-facing)
- Hook returns: `userTier: 'free' | 'paid'` (internal)
- UI strings: Always "Pro Promagen" or "Standard Promagen"

---

## 2. Promagen v1 (Free, no sign-in)

Version 1 of Promagen is **completely free**.

The purpose of v1 is:

- Stability
- Correctness
- Behavioural truth
- Real-world bug discovery

There is **no sign-in** during this phase.

Free users see the world as Promagen defines it:

- Neutral
- Predictable
- Honest
- Calm

No personalisation, no memory, no gating.

---

### 2.1 Free features (explicit list)

The following features are available to all users without sign-in:

- **Stock exchange cards** — Default selection of 12 exchanges
- **Live local time clocks** — Each exchange card displays the current local time in that exchange's timezone
- **Market status indicators** — Open/closed status for each exchange
- **FX ribbon** — Real-time foreign exchange data (subject to API budget rules)
- **Weather badges** — Current weather for each exchange city
- **AI Providers Leaderboard** — Browse and compare all 42 AI image generation providers
- **Market Pulse (4 exchanges)** — Visual connection animations for Sydney, Hong Kong, London, and Chicago

These features define the baseline experience.
They are complete and honest.

---

## 3. Sign-in (not paid): memory, context, and prompt access

After v1 is stable, **sign-in is introduced**.

Sign-in **unlocks access to the prompt builder** and provides memory and context.

### 3.1 Authentication provider

Promagen uses **Clerk** as its identity provider. See `docs/authority/clerk-auth.md` for technical details.

Sign-in methods:
- Google OAuth
- Apple OAuth
- Facebook OAuth
- Email/password

### 3.2 Prompt builder access (tiered)

**Anonymous users (not signed in):**
- **5 free prompts per day** before sign-in required
- **Daily reset at midnight** in user's local timezone (same as authenticated users)
- Anonymous usage counter visible: "X/5 free prompts"
- Stored in localStorage (browser-local, no account needed)
- After 5 prompts: overlay locks with "Sign in to continue" button

**Visual treatment when locked (anonymous or free user at limit):**
- All category dropdowns show **disabled styling only** (purple-tinted, non-interactive)
- **NO "Sign in to continue" text displayed inside individual dropdowns** (clean UX)
- Centred overlay with action button at top of the prompt builder section
- Message: "You've used your 5 free prompts" (anonymous) or "Daily limit reached" (free user)
- Benefits list shown in overlay
- Lock icon appears in dropdown labels only
- Dropdown arrows hidden when locked
- Dropdowns show empty placeholder when locked

**Free tier prompt access (after sign-in):**
- **Full access to all 12 categories** with ~2,100 curated prompt terms
- **Platform-aware selection limits** as documented in §5.5 and prompt-builder-page.md
- **30 prompts per day** — tracked on "Copy prompt" button clicks
- **Daily reset at midnight** in user's local timezone
- When quota reached: dropdowns lock with "Upgrade to Pro Promagen for unlimited" message

### 3.3 Usage tracking system

**Trigger event:** "Copy prompt" button click — the moment users extract value from Promagen's curation work

**Anonymous tracking (localStorage v2):**
- 5 prompts per day (resets at midnight local time)
- Key: `promagen:anonymous:usage`
- Schema version: 2 (includes daily reset tracking)
- Tamper detection: checksum validation prevents manipulation
- Daily reset: `lastResetDate` field tracks when counter last reset

**Anonymous storage schema v2:**
```typescript
interface AnonymousUsageData {
  count: number;           // Prompt copy count (resets daily)
  firstUse: string;        // First use timestamp (ISO)
  lastUse: string;         // Last use timestamp (ISO)
  lastResetDate: string;   // Date of last reset (YYYY-MM-DD)
  version: 2;              // Schema version
  checksum: string;        // Tamper detection hash
}
```

**Migration from v1:** Previous v1 data (without `lastResetDate`) is invalidated on read, triggering a fresh start with v2 schema. This gives existing anonymous users a clean slate with the new daily reset behavior.

**Authenticated tracking (Vercel KV):**
- Free users: 30 prompt copies per day
- Paid users: Unlimited prompt copies
- Counter resets at midnight in user's detected timezone
- Storage: Vercel KV (consistent with voting system)

**Lock state progression:**
1. **Anonymous (0-4 uses):** Full access + "X/5 free prompts today" counter
2. **Anonymous (5+ uses):** LOCKED + "Sign in to continue" button at top of overlay
3. **Free signed-in (0-29):** Full access + "X/30 prompts today" counter
4. **Free signed-in (30):** LOCKED + "Upgrade to Pro Promagen" button at top of overlay
5. **Pro Promagen:** Always enabled + expanded selection limits, no counter

**Lock state component behavior:**
- Combobox dropdowns: Disabled styling (purple tint, opacity reduced), NO overlay text
- Dropdown arrows: Hidden when locked
- Randomise button: Disabled when locked
- Free text input: Disabled when locked (cannot type)
- Copy prompt button: Shows "Sign in to continue" or "Upgrade" as appropriate
- Aspect ratio selector: Disabled buttons with reduced opacity, NO overlay text

### 3.4 Geographic exchange ordering (requires sign-in)

When a user signs in:

- **Location detection:** Browser geolocation API (free) with IP geolocation fallback (free tier)
- Stock exchanges arranged **east → west relative to user's location**
- Exchange rails split based on relative geographic position to user
- **Standard Promagen users:** Location detection + relative ordering (no choice)
- **Pro Promagen users:** Toggle between "My Location" and "Greenwich Meridian" reference frames

### 3.5 Additional sign-in benefits (still free tier)

When a user signs in:

- **Image Quality votes are tracked** and persisted to account
- **Geographic context** — exchanges positioned relative to user's location
- **Usage memory** — daily prompt quota tracking

### 3.6 Explicit exclusions at sign-in stage

The following do **not** exist:

- No arbitrary time zone selection
- No city pickers
- No custom exchange ordering
- No drag-and-drop ordering
- No favourites-first behaviour

Sign-in unlocks **context and access**, not customisation.

---

## 4. Pro Promagen tier: control within invariant rules

Pro Promagen users do **not** gain the ability to rewrite reality.

They gain **controlled freedom within physical and logical invariants**.

### 4.1 Technical implementation

User tier is stored in **Clerk's publicMetadata**:

```json
{
  "tier": "free" | "paid"
}
```

**Setting tier via Clerk Dashboard:**
1. Users → Select user → Edit Public Metadata
2. Add: `{ "tier": "paid" }`

**Setting tier programmatically:**
```typescript
import { clerkClient } from '@clerk/nextjs/server';

await clerkClient.users.updateUser(userId, {
  publicMetadata: { tier: 'paid' }
});
```

**Reading tier in components:**
```typescript
import { usePromagenAuth } from '@/hooks/use-promagen-auth';

function Component() {
  const { userTier, categoryLimits, platformTier } = usePromagenAuth({ platformId });
  // userTier: 'free' | 'paid' (internal)
  // UI should display: "Standard Promagen" | "Pro Promagen"
  // categoryLimits: Platform-aware limits for current provider
  // platformTier: 1 | 2 | 3 | 4
}
```

---

## 5. Pro Promagen exclusive features

### 5.1 Unlimited daily prompts

Pro Promagen users have **unlimited daily prompt copies** — no counter, no quota.

---

### 5.2 Reference frame choice

Standard Promagen users see exchanges ordered relative to their detected location.

Pro Promagen users may choose their reference frame:

- "My Location" — exchanges ordered relative to geolocation
- "Greenwich Meridian" — exchanges ordered relative to 0° longitude

This is the **only reference frame control**.

---

### 5.3 Exchange hemisphere selection

Pro Promagen users may choose which exchanges appear.

Options:

- Global (default, even split)
- East-only (Asian + Oceanian markets)
- West-only (Americas + Europe)

Rules:

- Any combination is allowed
- All exchanges may be from one hemisphere if the user wishes
- Selection affects **scope only**, never ordering logic
- Ordering always follows longitude relative to chosen reference frame

---

### 5.4 Exchange count (scale control)

Pro Promagen users may choose how many exchanges are shown.

Allowed values:

- **6**
- **8**
- **10**
- **12**
- **14**
- **16**

Rules:

- Multiples of two only
- No odd numbers
- No arbitrary counts

This constraint is intentional and enforced.

---

### 5.5 Prompt builder selection limits (platform-aware precision control)

Selection limits are **platform-aware** — different AI platforms handle prompt complexity differently. The system assigns each of Promagen's 42 supported platforms to one of four tiers based on their prompt handling capabilities.

#### Platform Tier Philosophy

| Tier | Name | Prompt Style | Platforms |
|------|------|--------------|-----------|
| **Tier 1** | CLIP-Based | Tokenized keywords, high stacking tolerance | 13 platforms |
| **Tier 2** | Midjourney Family | Parameter-rich, very high tolerance | 2 platforms |
| **Tier 3** | Natural Language | Conversational prompts, medium tolerance | 10 platforms |
| **Tier 4** | Plain Language | Simple prompts work best, low tolerance | 17 platforms |

#### Selection Limits by Platform Tier (Standard Promagen)

| Category | Tier 1 (CLIP) | Tier 2 (MJ) | Tier 3 (NatLang) | Tier 4 (Plain) |
|----------|---------------|-------------|------------------|----------------|
| Subject | 1 | 1 | 1 | 1 |
| Action | 1 | 1 | 1 | 1 |
| **Style** | 2 | 3 | 2 | 1 |
| Environment | 1 | 1 | 1 | 1 |
| Composition | 1 | 1 | 1 | 1 |
| Camera | 1 | 1 | 1 | 1 |
| **Lighting** | 2 | 3 | 2 | 1 |
| **Colour** | 2 | 2 | 1 | 1 |
| **Atmosphere** | 2 | 2 | 1 | 1 |
| **Materials** | 2 | 2 | 1 | 1 |
| **Fidelity** | 2 | 3 | 2 | 1 |
| **Negative** | 5 | 8 | 3 | 2 |

#### Pro Promagen Bonus (+1 on stackable categories)

Pro Promagen users receive **+1 selection** on categories that benefit from stacking:

| Category | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|----------|--------|--------|--------|--------|
| Subject | 1 | 1 | 1 | 1 |
| Action | 1 | 1 | 1 | 1 |
| **Style** | **3** | **4** | **3** | **2** |
| Environment | 1 | 1 | 1 | 1 |
| Composition | 1 | 1 | 1 | 1 |
| Camera | 1 | 1 | 1 | 1 |
| **Lighting** | **3** | **4** | **3** | **2** |
| **Colour** | **3** | **3** | **2** | **2** |
| **Atmosphere** | **3** | **3** | **2** | **2** |
| **Materials** | **3** | **3** | **2** | **2** |
| **Fidelity** | **3** | **4** | **3** | **2** |
| **Negative** | **6** | **9** | **4** | **3** |

**Stackable categories:** Style, Lighting, Colour, Atmosphere, Materials, Fidelity, Negative

**Non-stackable categories (always 1):** Subject, Action, Environment, Composition, Camera

#### Platform Tier Assignments (All 42 Platforms)

**Tier 1 — CLIP-Based (13 platforms):**
`stability`, `leonardo`, `clipdrop`, `nightcafe`, `dreamstudio`, `lexica`, `novelai`, `dreamlike`, `getimg`, `openart`, `playground`, `artguru`, `jasper-art`

**Tier 2 — Midjourney Family (2 platforms):**
`midjourney`, `bluewillow`

**Tier 3 — Natural Language (10 platforms):**
`openai`, `adobe-firefly`, `ideogram`, `runway`, `microsoft-designer`, `bing`, `flux`, `google-imagen`, `imagine-meta`, `hotpot`

**Tier 4 — Plain Language (17 platforms):**
`canva`, `craiyon`, `deepai`, `pixlr`, `picwish`, `fotor`, `visme`, `vistacreate`, `myedit`, `simplified`, `freepik`, `picsart`, `photoleap`, `artbreeder`, `123rf`, `remove-bg`, `artistly`

#### Research Rationale

| Tier | Why These Limits? |
|------|-------------------|
| **Tier 1 (CLIP)** | CLIP tokenizes efficiently — stacking 2-3 styles/lights produces coherent results |
| **Tier 2 (MJ)** | Midjourney was built for complex prompts — handles 3+ styles, `--no` with 8+ terms |
| **Tier 3 (NatLang)** | Conversational models prefer focused prompts — too many terms cause confusion |
| **Tier 4 (Plain)** | Consumer-focused tools work best with simple prompts — one style, one mood |

#### Auto-Trim Behaviour

When a user switches platforms, selection limits may change. The system **silently trims** excess selections:

- Selections trimmed from end (keeps first N)
- No notification shown (clean UX)
- User can re-select different options if desired

**Example:** User on Midjourney (Tier 2) with 3 styles → switches to Artistly (Tier 4) → 2 styles automatically removed, 1 remains.

#### Dynamic Tooltip Guidance

Tooltips dynamically reflect the actual limit for the current platform:

- Artistly (Tier 4): "Pick 1 style. Keep it focused."
- Midjourney (Tier 2): "Pick up to 3 complementary styles. Avoid conflicting aesthetics."

Rules:

- Standard Promagen users have full access to all prompt options (after sign-in)
- Pro Promagen users gain **precision**, not **access**
- Selection limits adapt to each platform's capabilities
- The prompt builder remains complete and honest at all tiers

Authority for implementation: `docs/authority/prompt-builder-page.md`

---

### 5.6 Market Pulse city connections (expanded scope)

Market Pulse v2.0 visualises connections between stock exchanges and AI providers in the same city. The feature only activates during market open/close events (±1 minute windows).

**Standard Promagen (4 exchanges):**

| City      | Exchange | AI Provider(s)                           |
| --------- | -------- | ---------------------------------------- |
| Sydney    | ASX      | Leonardo AI                              |
| Hong Kong | HKEX     | Fotor, Artguru, PicWish                  |
| London    | LSE      | Stability AI, DreamStudio, Dreamlike.art |
| Chicago   | Cboe     | 123RF AI Generator                       |

**Pro Promagen adds (8 additional exchanges):**

| City     | Exchange       | AI Provider(s)         |
| -------- | -------------- | ---------------------- |
| New York | NYSE           | Runway ML, Artbreeder  |
| New York | NASDAQ         | Runway ML, Artbreeder  |
| Paris    | Euronext       | Clipdrop               |
| Toronto  | TSX            | Ideogram               |
| Taipei   | TWSE           | MyEdit (CyberLink)     |
| Vienna   | Wiener Börse   | Remove.bg (Kaleido AI) |
| Warsaw   | GPW            | Getimg.ai              |
| Warsaw   | WSE NewConnect | Getimg.ai              |

Rules:

- Standard Promagen users see pulse animations for 4 exchanges (7 provider connections)
- Pro Promagen users see pulse animations for all 12 exchanges (19 provider connections)
- The animation behaviour is identical at both tiers — only scope differs
- Multi-session exchanges (Hong Kong) fire on all session boundaries at both tiers

Authority for implementation: `docs/authority/ribbon-homepage.md` (Market Pulse v2.0 section)

---

### 5.7 Image Quality vote weight multiplier

Pro Promagen users receive a **1.5× multiplier** on all Image Quality votes.

| Signal Type | Standard Weight | Pro Promagen Weight |
|-------------|-----------------|---------------------|
| Image upload tagged to platform | 1 | 1.5 |
| Like on image | 2 | 3 |
| Favorable comment | 2 | 3 |
| Direct provider card like | 3 | 4.5 |

Rules:

- The multiplier is applied **server-side** and is not disclosed in the UI
- Both Standard and Pro Promagen users have the same **3 votes per day** limit
- Both Standard and Pro Promagen users have the same **1 vote per provider per 24 hours** limit
- The multiplier affects vote **weight**, not vote **count**
- This is a silent quality-of-influence enhancement, not a gating mechanism

**Rationale:** Pro Promagen users have demonstrated investment in the platform. Their quality assessments carry slightly more weight in aggregate rankings, creating an economic barrier to bot-farm manipulation while rewarding engaged users.

**Transparency policy:** If directly asked, Promagen will confirm that "rankings are based on community engagement signals" (truthful). The specific multiplier value is not disclosed to prevent gaming calculations.

Authority for implementation: `docs/authority/ai providers.md` (Community Voting System section)

---

## 6. Invariants (apply to everyone, always)

These rules are **never overridden**, including for paid users:

- Exchanges are **always ordered by longitude relative to reference frame**
- **Most easterly exchange appears on the left**
- **Most westerly exchange appears on the right**
- Ordering is **physics-based**, not user-defined
- No drag-and-drop ordering
- No favourites-first ordering
- No manual pinning
- **Prompt builder access requires sign-in** (no exceptions)

Users may choose **scope** and **reference**, but not **physics**.

---

## 7. What this document does NOT cover

This document does **not** redefine or duplicate:

- FX ribbon rules
- API cost control rules
- Caching and budget guards
- Analytics and metrics derivation
- UI layout invariants
- Market Pulse animation behaviour (only scope is defined here)
- Community voting mechanics (only weight multiplier is defined here)
- Authentication implementation details
- Prompt builder architecture details

Authority for those lives elsewhere:

- FX behaviour and SSOT rules → `docs/authority/ribbon-homepage.md`
- Market Pulse v2.0 specification → `docs/authority/ribbon-homepage.md`
- Cost control and provider authority → `promagen-api-brain-v2.md`
- Platform and spend guardrails → `vercel-pro-promagen-playbook.md`
- Prompt builder architecture → `docs/authority/prompt-builder-page.md`
- Community voting system → `docs/authority/ai providers.md`
- Authentication architecture → `docs/authority/clerk-auth.md`

This document only defines **who can control what**, and **when**.

---

## 8. Design intent (for future contributors)

This is not feature gating.
This is **perspective gating**.

- Standard Promagen users get a complete, honest product (after sign-in for prompt builder)
- Sign-in adds orientation, memory, and prompt access
- Pro Promagen adds control and focus
- No tier ever withholds truth

If a proposed Pro Promagen feature violates these principles, it does not belong in Promagen.

---

## 9. Change discipline

Any change to Pro Promagen behaviour must:

1. Be added explicitly to this document
2. State the exact capability gained
3. Preserve all invariants listed above

If it is not written here, it is Standard Promagen (free).

---

## Changelog

- **5 Jan 2026:** **PLATFORM-AWARE CATEGORY LIMITS v8.2.0** — Complete rewrite of §5.5. Selection limits are now platform-aware with 4 tiers (CLIP, Midjourney, Natural Language, Plain Language). Each of the 42 platforms assigned to appropriate tier. Pro Promagen users get +1 on stackable categories (style, lighting, colour, atmosphere, materials, fidelity, negative). Auto-trim on platform switch. Dynamic tooltip guidance shows actual limits. See prompt-builder-page.md for implementation details.
- **4 Jan 2026:** **ANONYMOUS DAILY RESET** — Anonymous users now get 5 prompts **per day** (resets at midnight local time), matching the authenticated user experience. Previously was 5 prompts total lifetime. Updated §3.2 and §3.3 with new behavior. Anonymous storage upgraded to v2 schema with `lastResetDate` field. Migration: v1 data invalidated on read, triggers fresh v2 start.
- **4 Jan 2026:** **LOCK STATE UX CLEANUP** — Lock state visual treatment now uses disabled styling only on dropdowns and aspect ratio selector. **Removed "Sign in to continue" text from individual dropdown overlays** (was ugly/cluttered UX). Lock icon only appears in dropdown labels. Updated §3.2 with detailed component behavior. Authority: prompt-builder-page.md.
- **3 Jan 2026:** **TERMINOLOGY UPDATE** — Renamed paid tier to "Pro Promagen" throughout. Added §1.1 Terminology section defining "Pro Promagen" and "Standard Promagen". Updated all user-facing references. Internal code variables remain `'paid'` for brevity.
- **3 Jan 2026:** **ANONYMOUS 5-TRY UPDATE** — Added 5 free prompts for anonymous users before sign-in required (§3.2). Anonymous usage stored in localStorage with tamper detection. Updated lock state progression to include anonymous states (§3.3). Lock overlay UI: button at top, no lock icon, centred layout.
- **2 Jan 2026:** **MAJOR UPDATE** — Added prompt builder authentication requirements (§3.2), usage quotas (§3.3), geographic ordering (§3.4), unlimited usage for paid (§5.1). Updated free features list to remove direct prompt access. Added location detection requirements. Updated invariants to include authentication.
- **2 Jan 2026:** Added §3.1 Authentication provider (Clerk). Added §4.1 Technical implementation (Clerk metadata). Added clerk-auth.md to §7 authority references.
- **2 Jan 2026:** Added §5.7 Image Quality vote weight multiplier. Added community voting authority reference to §7.
- **2 Jan 2026:** Added §5.6 Market Pulse city connections. Added Market Pulse (4 exchanges) to §2.1 free features. Added Market Pulse authority reference to §7.
- **1 Jan 2026:** Added §5.5 Prompt builder selection limits. Added prompt builder to §2.1 free features. Added prompt-builder-page.md to §7 authority references.
