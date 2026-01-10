# clerk-auth.md — Promagen Authentication Authority

**Status:** Authoritative  
**Scope:** Authentication architecture, Clerk integration, OAuth providers, user management  
**Created:** 2 January 2026  
**Last Updated:** 6 January 2026

---

## 1. Overview

Promagen uses **Clerk** as its identity provider (IdP). Clerk handles:

- User sign-up and sign-in
- Social OAuth (Microsoft, Google, Facebook)
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
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx...
CLERK_SECRET_KEY=sk_live_xxx...
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

User subscription tier and Pro Promagen selections are stored in Clerk's `publicMetadata`:

```json
{
  "tier": "free" | "paid",
  "fxSelection": {
    "pairIds": ["eur-usd", "gbp-usd", "usd-jpy", ...],
    "updatedAt": "2026-01-09T12:00:00Z"
  },
  "exchangeSelection": {
    "exchangeIds": ["tse-tokyo", "nyse-new-york", ...],
    "updatedAt": "2026-01-09T12:00:00Z"
  }
}
```

**Note:** `fxSelection` and `exchangeSelection` are only populated for Pro Promagen users. Free users use SSOT defaults. Both fields are optional.

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

## 8. OAuth Provider Configuration

### 8.1 Clerk Dashboard Setup

**Location:** Clerk Dashboard → Configure → SSO connections

| Provider | Status | Notes |
|----------|--------|-------|
| Microsoft | ✅ Enabled | Azure AD application |
| Google | ✅ Enabled | Google Cloud Console OAuth |
| Facebook | ✅ Enabled | Meta Developer Console |

### 8.2 Clerk Custom Domain

Production uses a custom domain for authentication:

| Setting | Value |
|---------|-------|
| Application domain mode | "application domain" |
| Custom domain | `clerk.promagen.com` |
| Accounts domain | `accounts.promagen.com` |
| OAuth callback URL | `https://clerk.promagen.com/v1/oauth_callback` |

**DNS Records Required:**

| Type | Name | Value |
|------|------|-------|
| CNAME | clerk | `frontend.clerk.accounts.dev` |
| CNAME | accounts | `accounts.clerk.accounts.dev` |

### 8.3 Microsoft OAuth

**Azure Portal Configuration:**

1. Go to Azure Portal → App registrations → Promagen
2. Authentication → Platform configurations → Add Web

| Setting | Value |
|---------|-------|
| Redirect URI | `https://clerk.promagen.com/v1/oauth_callback` |
| Supported account types | Accounts in any organizational directory and personal Microsoft accounts |

**Clerk Dashboard → Microsoft:**

| Field | Value |
|-------|-------|
| Client ID | (from Azure App Registration) |
| Client Secret | (from Azure App Registration → Certificates & secrets) |

### 8.4 Google OAuth

**Google Cloud Console Configuration:**

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)

| Setting | Value |
|---------|-------|
| Authorized JavaScript origins | `https://promagen.com`, `https://clerk.promagen.com` |
| Authorized redirect URIs | `https://clerk.promagen.com/v1/oauth_callback` |

**OAuth Consent Screen (Branding):**

| Field | Value |
|-------|-------|
| Application home page | `https://promagen.com` |
| Application privacy policy link | `https://promagen.com/privacy` |
| Application terms of service link | `https://promagen.com/terms` |
| Authorized domains | `promagen.com` |

**Clerk Dashboard → Google:**

| Field | Value |
|-------|-------|
| Client ID | (from Google Cloud Console, starts with numbers) |
| Client Secret | (from Google Cloud Console, starts with `GOCSPX-`) |

⚠️ **Important:** Client Secret starts with `GOCSPX-`, NOT the same as Client ID.

### 8.5 Facebook OAuth

**Meta Developer Console Configuration:**

1. Go to Meta Developer Console → Promagen app
2. Use cases → Authenticate and request data → Customize → Settings

| Setting | Value |
|---------|-------|
| Valid OAuth Redirect URIs | `https://clerk.promagen.com/v1/oauth_callback` |
| Allowed Domains for JavaScript SDK | `promagen.com` |
| App Domains (in Basic settings) | `promagen.com` |

**Client OAuth Settings (Toggles):**

| Setting | Value |
|---------|-------|
| Client OAuth login | ✅ ON |
| Web OAuth login | ✅ ON |
| Enforce HTTPS | ✅ ON |
| Force Web OAuth reauthentication | ❌ OFF |
| Embedded browser OAuth login | ❌ OFF |
| Use Strict Mode for redirect URIs | ✅ ON |

**Permissions:**

| Permission | Status |
|------------|--------|
| email | ✅ Ready to use (no review required) |
| public_profile | ✅ Ready to use (no review required) |

**Clerk Dashboard → Facebook:**

| Field | Value |
|-------|-------|
| Client ID | (App ID from Meta Developer Console) |
| Client Secret | (App Secret from Meta Developer Console) |

**Facebook App Review:**

| User Type | Can Use? |
|-----------|----------|
| Developer (you) | ✅ Yes |
| Testers (added in App Roles) | ✅ Yes |
| Public users | ❌ Requires App Review |

For public launch, submit for App Review in Meta Developer Console.

---

## 9. AuthButton Component

### 9.1 Features

The `AuthButton` component (`src/components/auth/auth-button.tsx`) handles:

| Feature | Implementation |
|---------|----------------|
| Signed out state | Purple-pink gradient "Sign in" button |
| Signed in state | Clerk UserButton with avatar |
| Loading state | Dimmed loading indicator |
| Clerk load timeout | Fallback to `/sign-in` link after 3s |
| OAuth redirect handling | Direct Clerk client state polling |
| Facebook hash cleanup | Removes `#_=_` from URL after OAuth |
| Stuck state recovery | Auto-reload if session cookie exists but Clerk stuck |

### 9.2 State Detection

The component uses direct Clerk client state checking for reliability:

```typescript
const clerk = useClerk();

const checkSessionState = useCallback(() => {
  if (!clerk.loaded) return 'loading';
  if (clerk.user) return 'signed-in';
  if (clerk.session) return 'signed-in';
  return 'signed-out';
}, [clerk]);
```

### 9.3 Auto-Recovery

If Clerk hooks fail to sync after OAuth redirect (shows "Loading..." indefinitely):

1. Component polls Clerk client state every 500ms
2. After 3 seconds, checks for session cookies (`__session`, `__client`, `__clerk`)
3. If cookies exist but state still loading, triggers one page reload
4. Uses sessionStorage flag to prevent reload loops

### 9.4 Facebook Hash Cleanup

Facebook OAuth appends `#_=_` to redirect URLs. The component cleans this:

```typescript
const cleanupOAuthHash = useCallback(() => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash;
    if (hash === '#_=_' || hash === '#') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}, []);
```

---

## 10. CSP (Content Security Policy)

Clerk requires specific CSP directives. These are configured in `middleware.ts`:

### 10.1 Required Domains

```typescript
// Clerk custom domain (production)
'clerk.promagen.com',
'accounts.promagen.com',

// Clerk shared infrastructure
'*.clerk.accounts.dev',
'*.clerk.com',
'img.clerk.com',

// Cloudflare bot protection
'challenges.cloudflare.com',
```

### 10.2 Full CSP Configuration

```typescript
// script-src
script-src 'self' 'unsafe-inline' https://clerk.promagen.com https://accounts.promagen.com https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com

// img-src
img-src 'self' data: blob: https://img.clerk.com

// connect-src
connect-src 'self' https: https://clerk.promagen.com https://accounts.promagen.com https://*.clerk.accounts.dev https://*.clerk.com

// frame-src
frame-src 'self' https://challenges.cloudflare.com https://clerk.promagen.com https://accounts.promagen.com
```

---

## 11. Clerk Dashboard Configuration

### 11.1 Application Settings

| Setting | Value |
|---------|-------|
| Application name | Promagen |
| Theme | Dark |
| Primary colour | `#9333ea` (purple-600) |

### 11.2 Sign-in Options

| Provider | Status |
|----------|--------|
| Email address | ✅ Enabled |
| Microsoft OAuth | ✅ Enabled |
| Google OAuth | ✅ Enabled |
| Facebook OAuth | ✅ Enabled |

### 11.3 Production Checklist

- [x] Rename application to "Promagen"
- [x] Configure custom domain (`clerk.promagen.com`)
- [x] Configure Microsoft OAuth credentials
- [x] Configure Google OAuth credentials
- [x] Configure Facebook OAuth credentials
- [x] Add production domain (`promagen.com`)
- [x] Switch to production mode
- [x] Update environment variables with `pk_live_` / `sk_live_` keys
- [x] Update CSP in middleware.ts for custom domain
- [ ] Submit Facebook app for App Review (for public users)

---

## 12. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@clerk/nextjs` | ^5.x | Clerk SDK for Next.js |

Install:
```powershell
# From: frontend/
pnpm add @clerk/nextjs
```

---

## 13. Security Boundaries

### 13.1 Auth is Separate from Brain

Auth routes are **not** governed by the Brain (API cost-control system):

```
Auth subsystem:  /api/auth/* (Clerk handles)
Brain subsystem: /api/fx/* (cost-controlled)
```

These must never be mixed. Auth behaviour must not be affected by rate limits, TTL, or budget rules.

### 13.2 Server-Only Secrets

| Secret | Location | Never Expose To |
|--------|----------|-----------------|
| `CLERK_SECRET_KEY` | Server only | Client bundle |
| User `privateMetadata` | Server only | Client bundle |
| OAuth Client Secrets | Clerk Dashboard only | Client bundle |

Only `publicMetadata` (e.g., `tier`) is safe to read client-side.

---

## 14. Anonymous Usage Tracking

Anonymous users (not signed in) have limited access to the prompt builder with client-side tracking.

### 14.1 Anonymous Storage (v2.0.0)

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

### 14.2 Anonymous Limits

| Metric | Value |
|--------|-------|
| Daily prompt limit | 5 |
| Reset time | Midnight (local timezone) |
| Storage | localStorage |
| Tamper protection | Checksum validation |

### 14.3 Transition to Authenticated

When anonymous user signs in:
- localStorage tracking continues until limit reached
- After sign-in, usage tracked in Vercel KV
- Anonymous localStorage cleared on explicit request only

Authority for anonymous usage rules: `docs/authority/paid_tier.md` §3.2-3.3

---

## 15. Troubleshooting

### 15.1 Sign-in Modal Blank

**Cause:** CSP blocking Clerk domains

**Fix:** Add to `middleware.ts` CSP:
```typescript
'clerk.promagen.com',
'accounts.promagen.com',
```

### 15.2 OAuth "Unable to complete action"

**Cause:** Redirect URI mismatch or missing permissions

**Fix:**
1. Check OAuth provider console for correct redirect URI: `https://clerk.promagen.com/v1/oauth_callback`
2. Ensure required permissions are enabled (email, profile)
3. Verify Client ID and Client Secret in Clerk Dashboard

### 15.3 Google "Invalid Scopes: email"

**Cause:** Email permission not enabled in Google Cloud Console

**Fix:** Already enabled by default for basic OAuth - check OAuth consent screen is configured

### 15.4 Google OAuth Failing

**Cause:** Wrong Client Secret in Clerk Dashboard

**Fix:** 
- Client ID starts with numbers (e.g., `238625941474-...`)
- Client Secret starts with `GOCSPX-` (NOT the same as Client ID)

### 15.5 Auth Button Stuck on "Loading..."

**Cause:** Clerk hooks not syncing after OAuth redirect

**Fix:** AuthButton v5 includes auto-recovery:
1. Polls Clerk client state every 500ms
2. If session cookies exist but stuck after 3s, triggers page reload
3. Uses sessionStorage flag to prevent reload loops

### 15.6 Facebook URL Shows `#_=_`

**Cause:** Facebook OAuth quirk - appends hash to redirect

**Fix:** AuthButton cleans this automatically on mount and session change

---

## 16. Wiring Voting (Next Step)

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

## 17. Related Authority Documents

| Document | Relationship |
|----------|--------------|
| `paid_tier.md` | Defines tier capabilities (what free vs paid can do) |
| `prompt-builder-page.md` | Prompt builder authentication and lock states |
| `TODO-api-integration.md` | Tracks remaining activation tasks |
| `promagen-api-brain-v2.md` | API routes table (auth routes marked) |
| `ai providers.md` | Community voting system (requires auth) |

---

## Changelog

- **6 Jan 2026:** Major update. Added §8 OAuth Provider Configuration (Microsoft, Google, Facebook). Added §9 AuthButton Component with state detection, auto-recovery, and Facebook hash cleanup. Updated §10 CSP with custom domain. Added §15 Troubleshooting. Updated production checklist in §11.3.
- **4 Jan 2026:** Added §14 (previously §13) Anonymous Usage Tracking documenting localStorage v2.0.0 schema with daily reset. Added reference to anonymous storage file location and migration behavior.
- **3 Jan 2026:** Added Pro Promagen terminology notes in §6 (User Tiers). Internal code uses 'paid', UI displays "Pro Promagen".
- **2 Jan 2026:** Initial version. Clerk integration complete. Auth button in header. Sign-in/sign-up pages created. CSP configured. usePromagenAuth hook created.
