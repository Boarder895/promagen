# clerk-auth.md — Promagen Authentication Authority

**Status:** Authoritative  
**Scope:** Authentication architecture, Clerk integration, OAuth providers, user management  
**Created:** 2 January 2026  
**Last Updated:** 9 April 2026  
**Version:** 3.0.0

---

## 1. Overview

Promagen uses **Clerk** as its identity provider (IdP). Clerk handles:

- User sign-up and sign-in
- Social OAuth (Microsoft, Google, Facebook)
- Email/password authentication
- Session management
- User metadata storage (tier, Stripe IDs, period end)

Promagen does **not** store passwords or manage authentication directly. Tier transitions (free → paid, cancellation) are managed by Stripe webhooks writing to Clerk `publicMetadata`.

---

## 2. Architecture

### 2.1 Authentication Flow

```
User clicks "Sign In"
       ↓
Clerk modal opens (hosted UI)
       ↓
User authenticates (social or email)
       ↓
Clerk issues session token (JWT in __session cookie)
       ↓
ClerkProvider makes auth state available (client-side)
       ↓
usePromagenAuth() hook provides isAuthenticated, userId, userTier, lockState, categoryLimits
```

### 2.2 Server-Side Auth Pattern (Critical)

Clerk's `auth()` from `@clerk/nextjs/server` **fails on Vercel production** — it returns `{ userId: null }` for API route handlers. This is a known issue with `@clerk/nextjs` v6.x on Next.js 16.

**Working pattern:** All authenticated API routes use `getSessionFromCookie()` from `src/lib/stripe/clerk-session.ts`, which decodes the `__session` JWT cookie directly:

```typescript
import { getSessionFromCookie } from '@/lib/stripe/clerk-session';

export async function POST(request: NextRequest) {
  const session = getSessionFromCookie(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // session.userId, session.tier, session.stripeCustomerId available
}
```

**Routes using this pattern:**
- `src/app/api/saved-prompts/route.ts` (CRUD)
- `src/app/api/saved-prompts/[id]/route.ts` (single prompt)
- `src/app/api/saved-prompts/sync/route.ts` (localStorage → cloud migration)
- `src/app/api/stripe/checkout/route.ts` (create Stripe session)

### 2.3 Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ClerkProvider` | `src/app/layout.tsx` | Wraps app, provides auth context |
| `clerkMiddleware` | `src/proxy.ts` | Protects routes, enforces auth, CSP headers |
| `getSessionFromCookie` | `src/lib/stripe/clerk-session.ts` | JWT decode for server-side API routes |
| `AuthButton` | `src/components/auth/auth-button.tsx` | Header Sign In / User avatar |
| `usePromagenAuth` | `src/hooks/use-promagen-auth.ts` | Hook for auth state (v2.0.0) |
| `HomepageClient` | `src/components/home/homepage-client.tsx` | Wires auth to homepage UI |
| Sign-in page | `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk hosted sign-in |
| Sign-up page | `src/app/sign-up/[[...sign-up]]/page.tsx` | Clerk hosted sign-up |

---

## 3. Files Reference

### 3.1 Auth Files

```
src/
├── proxy.ts                              ← Edge middleware (was middleware.ts, renamed for Next.js 16)
├── app/
│   ├── sign-in/[[...sign-in]]/page.tsx   ← Clerk sign-in page (dark themed)
│   └── sign-up/[[...sign-up]]/page.tsx   ← Clerk sign-up page (dark themed)
├── components/
│   └── auth/
│       ├── auth-button.tsx               ← Header auth button (Sign In / Avatar)
│       └── index.ts                      ← Barrel export
├── hooks/
│   └── use-promagen-auth.ts              ← Auth hook v2.0.0 (platform-aware limits)
└── lib/
    └── stripe/
        └── clerk-session.ts              ← JWT decode for server-side auth
```

### 3.2 Modified Files

| File | Changes |
|------|---------|
| `src/app/layout.tsx` | `<ClerkProvider>` wrapper, Vercel Analytics, SpeedInsights |
| `src/proxy.ts` | `clerkMiddleware`, protected routes, CSP, admin gates, security headers |
| `src/components/home/homepage-client.tsx` | `usePromagenAuth()` wired — auth fully integrated |

### 3.3 Legacy Auth Files (still present in codebase)

| File | Status |
|------|--------|
| `src/app/api/auth/login/route.ts` | Replaced by Clerk — candidate for deletion |
| `src/app/api/auth/logout/route.ts` | Replaced by Clerk — candidate for deletion |
| `src/app/api/auth/me/route.ts` | Replaced by Clerk's `useAuth()` — candidate for deletion |
| `src/app/api/auth/tests/` | Test routes — behind admin gate |

---

## 4. Environment Variables

### 4.1 Required (Clerk)

```env
# Clerk Authentication (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx...
CLERK_SECRET_KEY=sk_live_xxx...
NEXT_PUBLIC_CLERK_FAPI=clerk.promagen.com
```

### 4.2 Optional (Clerk URLs)

```env
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

### 4.3 Production Keys

| Environment | Key Prefix |
|-------------|------------|
| Development | `pk_test_`, `sk_test_` |
| Production | `pk_live_`, `sk_live_` |

### 4.4 Admin Access

```env
ADMIN_USER_IDS=user_abc123,user_def456    # Comma-separated Clerk user IDs
```

---

## 5. Protected Routes

Routes protected by `clerkMiddleware` in `src/proxy.ts` (require `auth.protect()`):

```typescript
const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/settings(.*)',
  '/saved(.*)',
  '/test(.*)',
  '/api/admin(.*)',
  '/api/tests(.*)',
]);
```

**Admin-only gates** (subset of protected — requires `ADMIN_USER_IDS` membership):

```typescript
const isAdminPageRoute = createRouteMatcher(['/admin(.*)']);
const isAdminApiRoute = createRouteMatcher(['/api/admin(.*)']);
```

**Note:** `/api/saved-prompts/*` and `/api/stripe/*` are NOT in the protected route matcher. They use `getSessionFromCookie()` for auth instead of relying on `auth.protect()`. This is by design — Clerk's `auth()` fails in Vercel production API route handlers.

**Public routes:** Homepage, provider pages, prompt builder, authority pages, guides — all accessible without sign-in.

---

## 6. User Tiers (Clerk Metadata + Stripe)

User subscription tier is stored in Clerk's `publicMetadata` and managed by Stripe webhooks:

```json
{
  "tier": "free" | "paid",
  "stripeCustomerId": "cus_xxx",
  "stripeSubscriptionId": "sub_xxx",
  "stripePeriodEnd": 1720000000,
  "fxSelection": { "pairIds": [...], "updatedAt": "..." },
  "exchangeSelection": { "exchangeIds": [...], "updatedAt": "..." }
}
```

### 6.1 Tier Lifecycle (Stripe Webhook Driven)

| Stripe Event | Action |
|-------------|--------|
| `checkout.session.completed` | Set `tier: 'paid'`, store Stripe IDs + `stripePeriodEnd` |
| `customer.subscription.updated` | Track cancellation state + updated `stripePeriodEnd` |
| `customer.subscription.deleted` | Revert `tier: 'free'`, clear Stripe period data |

**Webhook handler:** `src/app/api/stripe/webhook/route.ts`

### 6.2 Stripe Routes

| Route | Purpose |
|-------|---------|
| `POST /api/stripe/checkout` | Create Stripe Checkout session (monthly or annual) |
| `POST /api/stripe/portal` | Create Stripe Customer Portal session (manage subscription) |
| `POST /api/stripe/webhook` | Receive Stripe webhook events |
| `GET /api/stripe/webhook/health` | Webhook health check |
| `GET /api/stripe/debug` | Debug Stripe state (admin only) |

### 6.3 Terminology

- Internal code: `'free'` and `'paid'`
- User-facing UI: "Standard Promagen" and "Pro Promagen"
- See `docs/authority/paid_tier.md` §1.1 for full terminology rules

---

## 7. usePromagenAuth Hook (v2.0.0)

The hook provides a unified interface for auth-dependent features with platform-aware category limits:

```typescript
interface PromagenAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  userTier: 'free' | 'paid';
  voteWeight: number;             // 1.0 (free) or 1.5 (paid)
  lockState: LockState;           // 'anonymous_limit' | 'unlocked' | 'quota_reached'
  categoryLimits: CategoryLimits; // Platform-tier-aware selection limits
  platformTier: CompressionTier;  // T1 CLIP | T2 MJ | T3 NatLang | T4 Plain
  locationInfo: LocationInfo;     // User location + reference frame
  setReferenceFrame: (frame: ReferenceFrame) => void;
}
```

### 7.1 Lock State Progression

| State | Condition | UI Action |
|-------|-----------|-----------|
| `anonymous_limit` | Anonymous user reached 3 free prompts | Sign In CTA |
| `unlocked` | Under limit OR authenticated with quota OR paid | Normal access |
| `quota_reached` | Free authenticated user used daily limit | Go Pro CTA |

### 7.2 Reference Frame

| User Type | Default Frame | Can Toggle |
|-----------|--------------|------------|
| Anonymous | Greenwich | No |
| Free signed-in | User location | No |
| Paid signed-in | User location | Yes (User ↔ Greenwich) |

### 7.3 Usage

```typescript
const { categoryLimits, platformTier, lockState } = usePromagenAuth({ platformId: 'midjourney' });
```

---

## 8. OAuth Provider Configuration

### 8.1 Providers

| Provider | Status |
|----------|--------|
| Microsoft | ✅ Enabled (Azure AD) |
| Google | ✅ Enabled (Google Cloud Console) |
| Facebook | ✅ Enabled (Meta Developer Console) |

### 8.2 Custom Domain

| Setting | Value |
|---------|-------|
| Custom domain | `clerk.promagen.com` |
| Accounts domain | `accounts.promagen.com` |
| OAuth callback URL | `https://clerk.promagen.com/v1/oauth_callback` |

**DNS Records:**

| Type | Name | Value |
|------|------|-------|
| CNAME | clerk | `frontend.clerk.accounts.dev` |
| CNAME | accounts | `accounts.clerk.accounts.dev` |

---

## 9. CSP (Content Security Policy)

Configured in `src/proxy.ts`. Clerk FAPI domain is dynamically read from `NEXT_PUBLIC_CLERK_FAPI` env var:

```typescript
// Required domains
'clerk.promagen.com',
'accounts.promagen.com',
'*.clerk.accounts.dev',
'*.clerk.com',
'img.clerk.com',
'challenges.cloudflare.com',
```

---

## 10. Anonymous Usage Tracking

### 10.1 Anonymous Limits

| Metric | Value |
|--------|-------|
| Daily prompt limit | **3** |
| Reset time | Midnight (local timezone) |
| Storage | localStorage |
| Tamper protection | Checksum validation |
| Constant | `ANONYMOUS_FREE_LIMIT` in `src/lib/usage/constants.ts` |

### 10.2 Storage Schema

**File:** `src/lib/usage/anonymous-storage.ts`  
**Key:** `promagen:anonymous:usage`

```typescript
interface AnonymousUsageData {
  count: number;
  firstUse: string;
  lastUse: string;
  lastResetDate: string;
  version: 2;
  checksum: string;
}
```

---

## 11. Saved Prompts Cloud Sync

**Fixed 8 Apr 2026.** The saved prompts system now supports dual-mode storage:

| User Type | Storage | Mechanism |
|-----------|---------|-----------|
| Free / Anonymous | localStorage | Client-only |
| Pro Promagen | Postgres (cloud) + localStorage shadow | `getSessionFromCookie()` auth |

**Hook:** `src/hooks/use-saved-prompts.ts` (v3.2.1)

Key features: cloud shadow localStorage backup, operation queue for auth transitions, merge-by-ID on cloud refresh, debounced authoritative re-fetches.

**`clearAll()` contract:** Client-state-only reset (Option B). A full cloud-aware "Delete my entire library" requires a future `DELETE /api/saved-prompts/all` route. These are separate operations.

---

## 12. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@clerk/nextjs` | ^6.x | Clerk SDK for Next.js |

---

## 13. Security Boundaries

### 13.1 Auth is Separate from Brain

Auth routes are **not** governed by the Brain (API cost-control system). Auth behaviour must not be affected by rate limits, TTL, or budget rules.

### 13.2 Server-Only Secrets

| Secret | Location | Never Expose To |
|--------|----------|-----------------|
| `CLERK_SECRET_KEY` | Server only | Client bundle |
| `STRIPE_SECRET_KEY` | Server only | Client bundle |
| `STRIPE_WEBHOOK_SECRET` | Server only | Client bundle |
| User `privateMetadata` | Server only | Client bundle |
| OAuth Client Secrets | Clerk Dashboard only | Client bundle |

Only `publicMetadata` (tier, Stripe IDs) is safe to read client-side via session claims.

---

## 14. Troubleshooting

### 14.1 Server-Side `auth()` Returns Null

**Cause:** Known issue — Clerk's `auth()` fails in Vercel production API route handlers on Next.js 16 + `@clerk/nextjs` v6.x.

**Fix:** Use `getSessionFromCookie()` from `src/lib/stripe/clerk-session.ts` instead. This decodes the `__session` JWT directly. All saved-prompts and Stripe routes already use this pattern.

### 14.2 Sign-in Modal Blank

**Cause:** CSP blocking Clerk domains.  
**Fix:** Ensure `NEXT_PUBLIC_CLERK_FAPI` env var is set. `proxy.ts` reads it to build CSP dynamically.

### 14.3 Auth Button Stuck on "Loading..."

**Cause:** Clerk hooks not syncing after OAuth redirect.  
**Fix:** AuthButton includes auto-recovery: polls state every 500ms, triggers page reload after 3s if cookies exist but state is stuck. SessionStorage flag prevents loops.

### 14.4 middleware.ts Deprecation Warning

**Cause:** Next.js 16 deprecated the `middleware.ts` convention.  
**Fix:** Already renamed to `proxy.ts`. If the warning persists, ensure no `middleware.ts` file exists at project root.

---

## 15. Related Authority Documents

| Document | Relationship |
|----------|--------------|
| `paid_tier.md` | Tier capabilities (what free vs paid can do) |
| `stripe.md` | Stripe integration, checkout, webhooks, portal |
| `saved-page.md` | Saved prompts cloud sync architecture |
| `promagen-api-brain-v2.md` | API routes table (auth routes marked) |
| `code-standard.md` | UI standards for auth-related components |

---

## Changelog

- **9 Apr 2026 (v3.0.0):** Major rewrite. Documented `proxy.ts` rename (was `middleware.ts`, Next.js 16). Added §2.2 server-side auth pattern (`getSessionFromCookie` replaces broken `auth()`). Updated §5 protected routes with admin gates. Rewrote §6 to cover Stripe webhook tier lifecycle. Updated §7 hook to v2.0.0 (platform-aware limits, lock states, reference frame). Fixed anonymous limit from 5 → 3. Added §11 saved prompts cloud sync. Added §12 Stripe routes. Removed §16 "Wiring Voting" (done — homepage-client.tsx wires `usePromagenAuth`). Added `NEXT_PUBLIC_CLERK_FAPI` to env vars. Updated dependencies to `@clerk/nextjs` ^6.x.
- **6 Jan 2026 (v1.1.0):** OAuth providers, AuthButton auto-recovery, CSP, troubleshooting.
- **2 Jan 2026 (v1.0.0):** Initial Clerk integration.

---

_This document is the authority for Promagen authentication. `src.zip` is the Single Source of Truth — if code and doc conflict, code wins._
