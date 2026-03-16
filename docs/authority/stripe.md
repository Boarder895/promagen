# stripe.md — Stripe Payment Integration for Pro Promagen

**Last updated:** 15 March 2026
**Version:** 1.0.0
**Status:** Authoritative
**Scope:** Payment infrastructure, subscription lifecycle, Clerk↔Stripe integration, and upgrade UX
**Owner:** Promagen Ltd (UK registered company, UK bank)
**Rule:** All payment behaviour is defined in this document. No payment logic may be invented outside of what is documented here.

---

## 1. Pricing decisions (final)

| Plan        | Price   | Currency | Billing           | Stripe Price type            | Trial      |
| ----------- | ------- | -------- | ----------------- | ---------------------------- | ---------- |
| **Monthly** | £15.99  | GBP      | Recurring monthly | `recurring` interval `month` | 7-day free |
| **Annual**  | £149.99 | GBP      | Recurring yearly  | `recurring` interval `year`  | 7-day free |

**Annual saving:** £41.89/year (21.8% off monthly equivalent of £191.88/year).
**Display copy:** "£12.49/month, billed annually — save £42"

### 1.1 Currency

One currency: **GBP only**. Promagen Ltd is UK-registered with a UK bank account.

- Stripe deposits GBP directly — no conversion fees, no FX loss.
- Non-UK customers pay in GBP; their bank converts at the cardholder's rate.
- HMRC bookkeeping is clean: GBP in, GBP recorded.

### 1.2 Free trial

Both plans include a **7-day free trial**.

- Stripe collects card details at checkout but charges £0.00 for the first 7 days.
- Clerk metadata is set to `tier: 'paid'` immediately on checkout completion (trial counts as active Pro).
- If the user cancels during the trial, they keep Pro access until the trial ends, then revert to free.
- Stripe handles trial-to-paid conversion automatically — no Promagen code needed.
- Configuration: `subscription_data.trial_period_days: 7` on the Checkout Session.

### 1.3 Cancellation policy

**Keep Pro until the billing period ends** (industry standard).

- When a user cancels, Stripe sets the subscription to cancel at period end (`cancel_at_period_end: true`).
- Promagen keeps `tier: 'paid'` in Clerk metadata until the period actually ends.
- When the period ends, Stripe fires `customer.subscription.deleted` → webhook reverts Clerk to `tier: 'free'`.
- No partial refunds. No immediate revocation.

---

## 2. Stripe Dashboard setup (manual — do this first)

### 2.1 Create the Product

1. Go to **Stripe Dashboard → Products → + Add product**
2. Name: `Pro Promagen`
3. Description: `Unlimited prompts, full prompt optimizer, prompt stacking, saved prompts, and more.`
4. Click **Save product**

### 2.2 Create Price 1 — Monthly

1. On the Pro Promagen product page → **+ Add another price**
2. Pricing model: **Standard pricing**
3. Price: `15.99`
4. Currency: `GBP`
5. Billing period: **Monthly**
6. Click **Save price**
7. **Copy the Price ID** (starts with `price_`) — you need this for the environment variable `STRIPE_PRICE_MONTHLY`    price_1TBNTKJr4qMNqiuzabYgL3ep

### 2.3 Create Price 2 — Annual

1. On the same product page → **+ Add another price**
2. Pricing model: **Standard pricing**
3. Price: `149.99`
4. Currency: `GBP`
5. Billing period: **Yearly**
6. Click **Save price**
7. **Copy the Price ID** (starts with `price_`) — you need this for the environment variable `STRIPE_PRICE_ANNUAL`  price_1TBNV2Jr4qMNqiuzRvIsnxQe

### 2.4 Set up the Customer Portal

1. Go to **Stripe Dashboard → Settings → Billing → Customer portal**
2. Enable: **Cancel subscription** (customers can cancel; cancellation takes effect at period end)
3. Enable: **Update payment method**
4. Enable: **View invoice history**
5. Disable: Switch plans (we handle plan changes ourselves, not via portal)
6. Branding: Upload Promagen logo, set brand colour to match the site
7. Click **Save**

### 2.5 Set up the Webhook

1. Go to **Stripe Dashboard → Developers → Webhooks → + Add endpoint**
2. Endpoint URL: `https://promagen.com/api/stripe/webhook`
3. Events to listen for:
   - `checkout.session.completed` — user completed payment/trial signup
   - `customer.subscription.updated` — plan changed, trial ended, payment failed
   - `customer.subscription.deleted` — subscription ended (cancellation or non-payment)
4. Click **Add endpoint**
5. **Copy the Webhook Signing Secret** (starts with `whsec_`) — you need this for `STRIPE_WEBHOOK_SECRET`

---

## 3. Environment variables

### 3.1 Required variables

| Variable                             | Source                                                     | Description                                                |
| ------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                  | Stripe Dashboard → Developers → API keys → Secret key      | Server-side API key (starts with `sk_live_` or `sk_test_`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys → Publishable key | Client-side key (starts with `pk_live_` or `pk_test_`)     |
| `STRIPE_WEBHOOK_SECRET`              | Stripe Dashboard → Developers → Webhooks → Signing secret  | Webhook signature verification (starts with `whsec_`)      |
| `STRIPE_PRICE_MONTHLY`               | From §2.2 step 7                                           | Price ID for £15.99/month (starts with `price_`)           |
| `STRIPE_PRICE_ANNUAL`                | From §2.3 step 7                                           | Price ID for £149.99/year (starts with `price_`)           |

### 3.2 Where to set them

**Local development** — `.env.local` (never committed):

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
```

**Production** — Vercel Dashboard → Settings → Environment Variables:

- Add all 5 variables above with `sk_live_` and `pk_live_` keys (not test keys).
- Scope: Production only. Use test keys for Preview/Development.

### 3.3 Sandbox vs Live

| Environment | Key prefix             | Webhook endpoint                          | Dashboard mode               |
| ----------- | ---------------------- | ----------------------------------------- | ---------------------------- |
| Development | `sk_test_`, `pk_test_` | `localhost` via Stripe CLI                | Test mode (toggle top-right) |
| Production  | `sk_live_`, `pk_live_` | `https://promagen.com/api/stripe/webhook` | Live mode                    |

**Important:** Product and Price IDs are different between test and live mode. You must create the Product and Prices in both modes, or use Stripe's "copy to live" feature when you go live.

---

## 4. Architecture — the purchase flow

### 4.1 Fewest-clicks flow (Approach A — sign-in first)

```
User lands on /pro-promagen
        │
        ▼
    ┌───────────────────────────────────┐
    │  Upgrade panel (bottom of centre  │
    │  column, same space as previews)  │
    │                                   │
    │  ┌─────────────┐ ┌─────────────┐  │
    │  │  £15.99/mo  │ │ £149.99/yr  │  │
    │  │  Monthly    │ │ Best Value  │  │
    │  │ [Subscribe] │ │ [Subscribe] │  │
    │  └─────────────┘ └─────────────┘  │
    └───────────────────────────────────┘
        │
        │ User clicks [Subscribe Monthly] or [Subscribe Annual]
        ▼
    ┌───────────────────────────────────┐
    │  Is user signed in (Clerk)?       │
    │  YES → proceed to checkout        │
    │  NO  → Clerk sign-in modal opens  │
    │         (Google/Microsoft/FB)      │
    │         → one click, no typing    │
    │         → then proceed            │
    └───────────────────────────────────┘
        │
        ▼
    ┌───────────────────────────────────┐
    │  POST /api/stripe/checkout        │
    │  Body: { priceId, plan }          │
    │  Server:                          │
    │    1. Verify Clerk auth           │
    │    2. Create Stripe Checkout      │
    │       Session with:               │
    │       - price = priceId           │
    │       - trial_period_days = 7     │
    │       - customer_email from Clerk │
    │       - metadata.clerkUserId      │
    │       - success_url               │
    │       - cancel_url                │
    │    3. Return session.url          │
    └───────────────────────────────────┘
        │
        ▼
    ┌───────────────────────────────────┐
    │  Redirect to Stripe Checkout      │
    │  (hosted by Stripe — PCI safe)    │
    │  - Email pre-filled from Clerk    │
    │  - Card input                     │
    │  - Apple Pay / Google Pay         │
    │  - 3D Secure handled by Stripe    │
    │  - Shows: "7-day free trial,      │
    │    then £15.99/month"             │
    └───────────────────────────────────┘
        │
        │ Payment method saved (£0 charged for trial)
        ▼
    ┌───────────────────────────────────┐
    │  Stripe fires webhook:            │
    │  checkout.session.completed       │
    │  → /api/stripe/webhook            │
    │  → Extract clerkUserId from       │
    │    session.metadata               │
    │  → Update Clerk publicMetadata:   │
    │    { tier: 'paid',                │
    │      stripeCustomerId: 'cus_...',  │
    │      stripeSubscriptionId: 'sub_...' }│
    └───────────────────────────────────┘
        │
        ▼
    ┌───────────────────────────────────┐
    │  Redirect to:                     │
    │  /pro-promagen?success=true       │
    │  Page detects tier: 'paid'        │
    │  → Shows Pro UI immediately       │
    │  → Success toast: "Welcome to     │
    │    Pro Promagen! 🎉"              │
    └───────────────────────────────────┘
```

**Total clicks for a returning user (already signed in):** 1 click (Subscribe) → card entry → done.
**Total clicks for a new user:** 1 click (Subscribe) → Clerk sign-in (1 click, OAuth) → card entry → done.

### 4.2 Subscription management flow (existing Pro users)

```
Pro user on /pro-promagen
        │
        ▼
    ┌───────────────────────────────────┐
    │  Upgrade panel shows:             │
    │  "Manage Subscription" button     │
    │  + "Save Preferences" button      │
    └───────────────────────────────────┘
        │
        │ User clicks [Manage Subscription]
        ▼
    ┌───────────────────────────────────┐
    │  POST /api/stripe/portal          │
    │  Server:                          │
    │    1. Verify Clerk auth           │
    │    2. Get stripeCustomerId from   │
    │       Clerk metadata              │
    │    3. Create Stripe Billing       │
    │       Portal session              │
    │    4. Return portal.url           │
    └───────────────────────────────────┘
        │
        ▼
    ┌───────────────────────────────────┐
    │  Stripe Customer Portal           │
    │  (hosted by Stripe)               │
    │  - Cancel subscription            │
    │  - Update payment method          │
    │  - View invoices                  │
    └───────────────────────────────────┘
```

### 4.3 Cancellation + reactivation flow

```
User cancels via Stripe Portal
        │
        ▼
    Stripe sets cancel_at_period_end = true
    Stripe fires: customer.subscription.updated
        │
        ▼
    Webhook receives event
    → Clerk metadata KEPT as tier: 'paid' (still active until period ends)
    → Optionally: set metadata.cancelAtPeriodEnd = true
    → UI can show: "Your Pro access ends on [date]"
        │
        │ ... billing period ends ...
        ▼
    Stripe fires: customer.subscription.deleted
        │
        ▼
    Webhook receives event
    → Update Clerk publicMetadata: { tier: 'free' }
    → Remove stripeSubscriptionId
    → User is now Standard Promagen
```

---

## 5. API routes (3 routes total)

### 5.1 POST /api/stripe/checkout

**Purpose:** Create a Stripe Checkout Session and return the redirect URL.

**Auth:** Clerk — user must be signed in. Returns 401 if not.

**Request body:**

```typescript
{
  plan: 'monthly' | 'annual';
}
```

**Server logic:**

1. Verify Clerk authentication via `auth()`.
2. Get user email from Clerk for pre-filling.
3. Look up if user already has a `stripeCustomerId` in Clerk metadata (returning customer).
4. Select Price ID: `plan === 'monthly'` → `STRIPE_PRICE_MONTHLY`, else → `STRIPE_PRICE_ANNUAL`.
5. Create Stripe Checkout Session:
   - `mode: 'subscription'`
   - `payment_method_types: ['card']`
   - `line_items: [{ price: priceId, quantity: 1 }]`
   - `subscription_data: { trial_period_days: 7 }`
   - `customer_email` (if no existing Stripe customer) OR `customer` (if returning)
   - `metadata: { clerkUserId: userId }`
   - `success_url: '{origin}/pro-promagen?success=true'`
   - `cancel_url: '{origin}/pro-promagen'`
   - `allow_promotion_codes: true` (future-proofs discount codes)
6. Return `{ url: session.url }`.

**Response:** `{ url: string }` — the frontend redirects to this URL.

**File:** `src/app/api/stripe/checkout/route.ts`

### 5.2 POST /api/stripe/webhook

**Purpose:** Handle Stripe webhook events to keep Clerk metadata in sync with subscription state.

**Auth:** None (Stripe calls this directly). Verified via webhook signature.

**Critical:** This route must use `export const runtime = 'nodejs'` and read the raw body for signature verification. Next.js App Router body parsing must be disabled for this route.

**Events handled:**

| Event                           | Action                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `checkout.session.completed`    | Set Clerk `publicMetadata.tier` to `'paid'`, store `stripeCustomerId` and `stripeSubscriptionId` |
| `customer.subscription.updated` | If `cancel_at_period_end` changed, optionally update metadata flag                               |
| `customer.subscription.deleted` | Set Clerk `publicMetadata.tier` to `'free'`, remove subscription ID                              |

**Server logic:**

1. Read raw body from request.
2. Verify Stripe webhook signature using `STRIPE_WEBHOOK_SECRET`.
3. Parse event type.
4. For `checkout.session.completed`:
   - Extract `clerkUserId` from `session.metadata`.
   - Extract `customer` (Stripe customer ID) and `subscription` (Stripe subscription ID).
   - Update Clerk user: `publicMetadata: { tier: 'paid', stripeCustomerId, stripeSubscriptionId }`.
5. For `customer.subscription.deleted`:
   - Look up Clerk user by `stripeCustomerId` stored in metadata (search Clerk users).
   - Update Clerk user: `publicMetadata: { tier: 'free' }`, remove `stripeSubscriptionId`.
6. Return `{ received: true }` with status 200.

**File:** `src/app/api/stripe/webhook/route.ts`

### 5.3 POST /api/stripe/portal

**Purpose:** Create a Stripe Customer Portal session for subscription management.

**Auth:** Clerk — user must be signed in and must have `stripeCustomerId` in metadata.

**Server logic:**

1. Verify Clerk authentication.
2. Read `stripeCustomerId` from Clerk `publicMetadata`.
3. If no customer ID → return 400 ("No active subscription").
4. Create Stripe Billing Portal session:
   - `customer: stripeCustomerId`
   - `return_url: '{origin}/pro-promagen'`
5. Return `{ url: session.url }`.

**Response:** `{ url: string }` — the frontend redirects to this URL.

**File:** `src/app/api/stripe/portal/route.ts`

---

## 6. Clerk metadata schema (updated)

Current schema (from `clerk-auth.md` §6):

```json
{
  "tier": "free" | "paid",
  "exchangeSelection": { ... },
  "fxSelection": { ... }
}
```

Updated schema with Stripe fields:

```json
{
  "tier": "free" | "paid",
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_...",
  "exchangeSelection": { ... },
  "fxSelection": { ... }
}
```

**Rules:**

- `stripeCustomerId` is set once on first checkout and persists forever (even after cancellation — allows resubscription without duplicate customers).
- `stripeSubscriptionId` is set on checkout, removed on subscription deletion.
- `tier` is the SSOT for access control — the rest of the app only reads `tier`, never the Stripe IDs directly.

---

## 7. Upgrade panel UX (UpgradeCta rewrite)

### 7.1 Free user view — side-by-side pricing cards

The upgrade panel occupies the **same space** as the preview windows (bottom of the centre column, `flex: 3 1 0%`). It appears when no feature card is hovered.

**Layout:** Two cards side-by-side, horizontally centred.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ┌──────────────────┐    ┌──────────────────────────┐  │
│   │    Monthly        │    │  ★ BEST VALUE            │  │
│   │                   │    │                          │  │
│   │   £15.99/month    │    │   £12.49/month           │  │
│   │                   │    │   billed as £149.99/year  │  │
│   │                   │    │   Save £42               │  │
│   │  [ Start Free     │    │  [ Start Free            │  │
│   │    Trial    ]     │    │    Trial          ]      │  │
│   └──────────────────┘    └──────────────────────────┘  │
│                                                         │
│    7-day free trial on both plans · Cancel any time     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Design rules:**

- Monthly card: neutral styling — `ring-1 ring-white/20`, subtle background
- Annual card: visually emphasised — emerald accent border (`ring-emerald-500/50`), "Best Value" badge, slightly more prominent (Von Restorff Effect)
- Both buttons say "Start Free Trial" (not "Subscribe" — trial-first framing reduces friction)
- Subtext below both: "7-day free trial on both plans · Cancel any time"
- **No toggle.** Both visible simultaneously (Loss Aversion — user sees what they'd overpay on monthly).
- Annual card shows "£12.49/month" as the primary number (anchoring to monthly comparison), then "billed as £149.99/year" smaller, then "Save £42" in emerald.

**Human factors applied:**

- **Loss Aversion (§8):** Monthly price next to annual makes the £42 loss visible.
- **Von Restorff Effect (§12):** Annual card is the only emerald element — stands out from the amber/neutral palette.
- **Cognitive Load (§11):** Two cards, one glance, instant comparison. No toggle, no hidden state.
- **Anchoring:** Monthly price shown first (left card) establishes the high anchor. Annual feels cheap by comparison.

### 7.2 Paid user view — manage + save

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│    Your preferences are saved                           │
│                                                         │
│    [ 💾 Save Preferences ]     [ Manage Subscription ]  │
│                                                         │
│    Changes apply to your homepage immediately            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- "Save Preferences" — existing behaviour, saves exchange/tier selections.
- "Manage Subscription" — calls `/api/stripe/portal`, redirects to Stripe-hosted portal.
- "Manage Subscription" styled as a secondary/ghost button (not the primary action).

### 7.3 Success state

When redirected back with `?success=true`:

- Show a brief success toast or banner: "Welcome to Pro Promagen! Your 7-day free trial has started. 🎉"
- Page re-renders with `isPaidUser: true` — all Pro features unlock immediately.
- Toast auto-dismisses after 5 seconds.

---

## 8. Dependencies

### 8.1 npm package

```
stripe
```

One package. Server-side only. No client-side Stripe.js needed (Stripe Checkout is a redirect, not an embedded form).

Install from: `C:\Users\Proma\Projects\promagen\frontend`

```powershell
pnpm add stripe
```

### 8.2 Stripe CLI (local development only)

For testing webhooks locally, Stripe CLI forwards events to localhost:

```powershell
# Install (Windows)
scoop install stripe

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a temporary webhook signing secret (`whsec_...`) — use that in `.env.local` during development.

---

## 9. File inventory (what gets built)

| #   | File                                          | Type       | Purpose                               |
| --- | --------------------------------------------- | ---------- | ------------------------------------- |
| 1   | `src/app/api/stripe/checkout/route.ts`        | API route  | Create Checkout Session               |
| 2   | `src/app/api/stripe/webhook/route.ts`         | API route  | Handle Stripe events → update Clerk   |
| 3   | `src/app/api/stripe/portal/route.ts`          | API route  | Create Customer Portal session        |
| 4   | `src/lib/stripe/stripe.ts`                    | Server lib | Stripe client singleton + helpers     |
| 5   | `src/components/pro-promagen/upgrade-cta.tsx` | Component  | Rewritten: side-by-side pricing cards |

**Total: 4 new files, 1 rewritten file.**

---

## 10. Security

| Concern               | Mitigation                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| PCI compliance        | Stripe Checkout is hosted by Stripe — no card data touches our servers                                                    |
| Webhook forgery       | Every webhook verified via `stripe.webhooks.constructEvent` with signing secret                                           |
| Unauthorised checkout | Clerk auth required before session creation — no anonymous purchases                                                      |
| Price manipulation    | Price IDs are server-side env vars — client sends `plan: 'monthly'` or `plan: 'annual'`, server maps to the real Price ID |
| Replay attacks        | Stripe webhook signatures include timestamp — stale events rejected                                                       |
| CSRF on API routes    | POST-only routes, Clerk session verification, no state-changing GETs                                                      |

---

## 11. Testing strategy

### 11.1 Stripe test mode

- Use `sk_test_` and `pk_test_` keys during development.
- Stripe provides test card numbers: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline).
- Test the full flow: subscribe → webhook fires → Clerk metadata updates → Pro UI appears.

### 11.2 Webhook testing

- Use Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`) to forward test events.
- Trigger test events: `stripe trigger checkout.session.completed`.
- Verify Clerk metadata updates correctly.

### 11.3 Edge cases to test

| Scenario                             | Expected behaviour                                                       |
| ------------------------------------ | ------------------------------------------------------------------------ |
| User subscribes monthly              | Pro access immediately, charged after 7 days                             |
| User subscribes annual               | Pro access immediately, charged after 7 days                             |
| User cancels during trial            | Pro until trial ends, then free, no charge                               |
| User cancels after trial             | Pro until period ends, then free                                         |
| Payment fails on renewal             | Stripe retries (Smart Retries), eventually `subscription.deleted` → free |
| User resubscribes after cancellation | Existing `stripeCustomerId` reused — no duplicate customer               |
| Already-Pro user clicks Subscribe    | Button not shown (paid user view shown instead)                          |
| Webhook event received twice         | Idempotent — setting `tier: 'paid'` twice is harmless                    |

---

## 12. Build order

| Step | What                                                           | Depends on                |
| ---- | -------------------------------------------------------------- | ------------------------- |
| 1    | Stripe Dashboard: create Product + 2 Prices + webhook + portal | Nothing                   |
| 2    | Set environment variables (`.env.local` + Vercel)              | Step 1 (Price IDs + keys) |
| 3    | `pnpm add stripe`                                              | Nothing                   |
| 4    | Build `src/lib/stripe/stripe.ts` (singleton)                   | Step 3                    |
| 5    | Build `src/app/api/stripe/checkout/route.ts`                   | Steps 2, 4                |
| 6    | Build `src/app/api/stripe/webhook/route.ts`                    | Steps 2, 4                |
| 7    | Build `src/app/api/stripe/portal/route.ts`                     | Steps 2, 4                |
| 8    | Rewrite `src/components/pro-promagen/upgrade-cta.tsx`          | Steps 5, 7                |
| 9    | Test full flow with Stripe CLI + test cards                    | Steps 5–8                 |
| 10   | Switch to live keys and deploy                                 | Step 9 passes             |

---

## 13. Future considerations (not built now)

These are noted for awareness. Do not implement until explicitly approved.

1. **Discount codes / promotion codes** — `allow_promotion_codes: true` is already set on the Checkout Session. You can create promo codes in Stripe Dashboard at any time without code changes.
2. **Plan switching** (monthly ↔ annual) — currently requires cancel + resubscribe. A proper proration flow could be built later.
3. **Usage-based billing** — if Promagen ever adds metered features (API calls, storage), Stripe supports usage records on subscriptions.
4. **Email receipts** — Stripe sends these automatically. Customise in Stripe Dashboard → Settings → Emails.
5. **Tax collection** — Stripe Tax can auto-calculate and collect VAT. Enable in Dashboard when needed for international compliance.

---

## 14. Document pointers

Add a single-line pointer in these existing authority docs:

| Document                   | Where to add                        | Pointer text                                                                                         |
| -------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `paid_tier.md`             | After §5.10 (Feature Control Panel) | `Payment integration authority: see docs/authority/stripe.md`                                        |
| `clerk-auth.md`            | After §6.2 (Reading User Tier)      | `Stripe↔Clerk sync and subscription metadata: see docs/authority/stripe.md §6`                       |
| `best-working-practice.md` | Terminology table                   | Add row: `stripeCustomerId / stripeSubscriptionId` — Clerk metadata fields managed by Stripe webhook |

---

## Changelog

| Date        | Version | Change                                                                               |
| ----------- | ------- | ------------------------------------------------------------------------------------ |
| 15 Mar 2026 | 1.0.0   | Initial document. Pricing, trial, Clerk integration, 3 API routes, upgrade panel UX. |
