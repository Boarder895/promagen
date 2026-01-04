# clerk-auth.md — Promagen Authentication Authority

**Status:** Authoritative  
**Scope:** Authentication architecture, Clerk integration, user management  
**Created:** 2 January 2026  
**Last Updated:** 4 January 2026

---

## 1. Overview

Promagen uses **Clerk** as its identity provider (IdP). Clerk handles:

- User sign-up and sign-in
- Social OAuth (Google, Apple, Facebook)
- Email/password authentication
- Session management
- User metadata storage

Promagen does **not** store passwords or manage authentication directly.

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
Clerk issues session token
       ↓
ClerkProvider makes auth state available
       ↓
usePromagenAuth() hook provides isAuthenticated, userId, userTier
```

### 2.2 Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ClerkProvider` | `src/app/layout.tsx` | Wraps app, provides auth context |
| `clerkMiddleware` | `src/middleware.ts` | Protects routes, enforces auth |
| `AuthButton` | `src/components/auth/auth-button.tsx` | Header Sign In / User avatar |
| `usePromagenAuth` | `src/hooks/use-promagen-auth.ts` | Hook for auth state in components |
| Sign-in page | `src/app/sign-in/[[...sign-in]]/page.tsx` | Clerk hosted sign-in |
| Sign-up page | `src/app/sign-up/[[...sign-up]]/page.tsx` | Clerk hosted sign-up |

---

## 3. Files Reference

### 3.1 New Files (Clerk Integration)

```
src/
├── app/
│   ├── sign-in/
│   │   └── [[...sign-in]]/
│   │       └── page.tsx          ← Clerk sign-in page (dark themed)
│   └── sign-up/
│       └── [[...sign-up]]/
│           └── page.tsx          ← Clerk sign-up page (dark themed)
├── components/
│   └── auth/
│       ├── auth-button.tsx       ← Header auth button (Sign In / Avatar)
│       └── index.ts              ← Barrel export
└── hooks/
    └── use-promagen-auth.ts      ← Auth hook for components
```

### 3.2 Modified Files

| File | Changes |
|------|---------|
| `src/app/layout.tsx` | Added `<ClerkProvider>` wrapper around app |
| `src/middleware.ts` | Added `clerkMiddleware`, protected routes, CSP headers for Clerk |
| `src/components/layout/homepage-grid.tsx` | Added `AuthButton` to header |

### 3.3 Deprecated Files (Safe to Delete)

| File | Reason |
|------|--------|
| `src/app/api/auth/login/route.ts` | Replaced by Clerk |
| `src/app/api/auth/logout/route.ts` | Replaced by Clerk |
| `src/app/api/auth/me/route.ts` | Replaced by Clerk's `useAuth()` |

---

## 4. Environment Variables

### 4.1 Required (Clerk)

```env
# Clerk Authentication (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx...
CLERK_SECRET_KEY=sk_test_xxx...
```

### 4.2 Optional (Clerk URLs)

```env
# Clerk redirect URLs (optional - defaults work)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

### 4.3 Production Keys

Development and production use **different keys**:

| Environment | Key Prefix |
|-------------|------------|
| Development | `pk_test_`, `sk_test_` |
| Production | `pk_live_`, `sk_live_` |

Production keys are obtained from Clerk Dashboard → Configure → API Keys after switching to production mode.

---

## 5. Protected Routes

Routes protected by `clerkMiddleware` (require authentication):

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

**Public routes:** Homepage, provider pages, prompt builder — all accessible without sign-in.

---

## 6. User Tiers (Clerk Metadata)

User subscription tier is stored in Clerk's `publicMetadata`:

```json
{
  "tier": "free" | "paid"
}
```

**Terminology note:**
- Internal code uses `'free'` and `'paid'` for brevity
- User-facing UI must use "Standard Promagen" and "Pro Promagen"
- See `docs/authority/paid_tier.md` §1.1 for full terminology rules

### 6.1 Setting User Tier

**Via Clerk Dashboard:**
1. Go to Users → Select user
2. Edit Public Metadata
3. Add: `{ "tier": "paid" }` (for Pro Promagen users)

**Via Clerk API (programmatic):**
```typescript
import { clerkClient } from '@clerk/nextjs/server';

await clerkClient.users.updateUser(userId, {
  publicMetadata: { tier: 'paid' } // Pro Promagen
});
```

### 6.2 Reading User Tier

```typescript
import { usePromagenAuth } from '@/hooks/use-promagen-auth';

function Component() {
  const { userTier, voteWeight } = usePromagenAuth();
  // userTier: 'free' | 'paid' (internal)
  // UI should display: "Standard Promagen" | "Pro Promagen"
  // voteWeight: 1.0 (Standard) | 1.5 (Pro Promagen)
}
```

---

## 7. usePromagenAuth Hook

The `usePromagenAuth` hook provides a unified interface for auth-dependent features:

```typescript
interface PromagenAuthState {
  isAuthenticated: boolean;    // True when signed in
  isLoading: boolean;          // True while Clerk loads
  userId: string | null;       // Clerk user ID
  email: string | null;        // User's email
  displayName: string | null;  // User's name
  avatarUrl: string | null;    // User's avatar
  userTier: 'free' | 'paid';   // Subscription tier
  voteWeight: number;          // 1.0 (free) or 1.5 (paid)
}
```

### 7.1 Usage Example

```typescript
'use client';

import { usePromagenAuth } from '@/hooks/use-promagen-auth';

function VotingComponent() {
  const { isAuthenticated, isLoading, voteWeight } = usePromagenAuth();

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <SignInPrompt />;

  return <VoteButton weight={voteWeight} />;
}
```

---

## 8. UI Components

### 8.1 AuthButton

Location: Header (top-right, aligned with right exchange rail)

| State | Display |
|-------|---------|
| Signed out | Purple-pink gradient "Sign in" button |
| Signed in | User avatar with dropdown menu |

Styling matches the "Randomise" button in prompt builder.

### 8.2 Sign-in/Sign-up Pages

Dark-themed Clerk hosted UI with:

- Social providers: Google, Apple, Facebook
- Email/password option
- Promagen colour scheme (slate, purple accents)

---

## 9. CSP (Content Security Policy)

Clerk requires specific CSP directives. These are configured in `middleware.ts`:

```typescript
// script-src: Clerk FAPI + Cloudflare challenges
script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com

// img-src: Clerk avatars
img-src 'self' data: blob: https://img.clerk.com

// connect-src: Clerk API
connect-src 'self' https: https://*.clerk.accounts.dev https://*.clerk.com

// frame-src: Cloudflare bot protection
frame-src 'self' https://challenges.cloudflare.com
```

---

## 10. Clerk Dashboard Configuration

### 10.1 Application Settings

| Setting | Value |
|---------|-------|
| Application name | Promagen |
| Theme | Dark |
| Primary colour | `#9333ea` (purple-600) |

### 10.2 Sign-in Options

Enable:
- ✅ Email address
- ✅ Google OAuth
- ✅ Apple OAuth
- ✅ Facebook OAuth

### 10.3 Production Checklist

Before going live:

- [ ] Rename application to "Promagen"
- [ ] Configure Google OAuth credentials
- [ ] Configure Apple OAuth credentials
- [ ] Configure Facebook OAuth credentials
- [ ] Add production domain (`promagen.com`)
- [ ] Switch to production mode
- [ ] Update environment variables with `pk_live_` / `sk_live_` keys

---

## 11. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@clerk/nextjs` | ^5.x | Clerk SDK for Next.js |

Install:
```powershell
# From: frontend/
pnpm add @clerk/nextjs
```

---

## 12. Security Boundaries

### 12.1 Auth is Separate from Brain

Auth routes are **not** governed by the Brain (API cost-control system):

```
Auth subsystem:  /api/auth/* (Clerk handles)
Brain subsystem: /api/fx/* (cost-controlled)
```

These must never be mixed. Auth behaviour must not be affected by rate limits, TTL, or budget rules.

### 12.2 Server-Only Secrets

| Secret | Location | Never Expose To |
|--------|----------|-----------------|
| `CLERK_SECRET_KEY` | Server only | Client bundle |
| User `privateMetadata` | Server only | Client bundle |

Only `publicMetadata` (e.g., `tier`) is safe to read client-side.

---

## 13. Anonymous Usage Tracking

Anonymous users (not signed in) have limited access to the prompt builder with client-side tracking.

### 13.1 Anonymous Storage (v2.0.0)

**File:** `src/lib/usage/anonymous-storage.ts`

Anonymous usage is tracked in localStorage with daily reset:

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

**Key:** `promagen:anonymous:usage`

**Daily reset:** If `lastResetDate !== today`, count resets to 0 on next read/increment.

**Migration:** v1 data (without `lastResetDate`) is invalidated, triggering fresh v2 start.

### 13.2 Anonymous Limits

| Metric | Value |
|--------|-------|
| Daily prompt limit | 5 |
| Reset time | Midnight (local timezone) |
| Storage | localStorage |
| Tamper protection | Checksum validation |

### 13.3 Transition to Authenticated

When anonymous user signs in:
- localStorage tracking continues until limit reached
- After sign-in, usage tracked in Vercel KV
- Anonymous localStorage cleared on explicit request only

Authority for anonymous usage rules: `docs/authority/paid_tier.md` §3.2-3.3

---

## 14. Wiring Voting (Next Step)

The voting system is ready but requires auth wiring:

**Current state:**
- `ProvidersTable` accepts `isAuthenticated` prop ✅
- `usePromagenAuth` hook provides `isAuthenticated` ✅
- Homepage passes `isAuthenticated={false}` (hardcoded) ❌

**To activate:**

1. Convert `src/app/page.tsx` to client component (or create wrapper)
2. Call `usePromagenAuth()` to get real auth state
3. Pass `isAuthenticated` to `ProvidersTable`

See: `docs/authority/TODO-api-integration.md` §1.1

---

## 15. Related Authority Documents

| Document | Relationship |
|----------|--------------|
| `paid_tier.md` | Defines tier capabilities (what free vs paid can do) |
| `prompt-builder-page.md` | Prompt builder authentication and lock states |
| `TODO-api-integration.md` | Tracks remaining activation tasks |
| `promagen-api-brain-v2.md` | API routes table (auth routes marked) |
| `ai providers.md` | Community voting system (requires auth) |

---

## Changelog

- **4 Jan 2026:** Added §13 Anonymous Usage Tracking documenting localStorage v2.0.0 schema with daily reset. Added reference to anonymous storage file location and migration behavior.
- **3 Jan 2026:** Added Pro Promagen terminology notes in §6 (User Tiers). Internal code uses 'paid', UI displays "Pro Promagen".
- **2 Jan 2026:** Initial version. Clerk integration complete. Auth button in header. Sign-in/sign-up pages created. CSP configured. usePromagenAuth hook created.
