# AI Providers Affiliate & Links

**Last updated:** 22 December 2025  
**Owner:** Promagen  
**Existing features preserved:** Yes

## Purpose

Promagen’s AI Providers surfaces (Leaderboard, Provider Detail, Prompt Builder) link users out to third-party AI provider websites.

This document defines the single outbound linking system so it is:

- UK-compliant (ASA/CAP disclosure)
- Privacy-minimal (no cookies required for click logging)
- Rock-solid traceable (server click_id + immutable log record)
- Secure (open-redirect resistant)

## UK compliance requirements (plain English)

### ASA/CAP disclosure (affiliate/referral links)

If a link can earn Promagen money (affiliate/referral), users must be told clearly and close to the link.

**Rules of thumb:**

- The disclosure must be “up front” (not buried on another page).
- Avoid vague wording like “may contain affiliate links” if the page is primarily outbound.
- Use a short, repeated label near CTAs and a slightly longer sentence near the table/page header.

### ICO/PECR cookie consent (we avoid cookies for affiliate logging)

Click logging for outbound links must not rely on cookies. Promagen’s outbound system is designed to be **cookie-free**.

If Promagen uses analytics cookies elsewhere (GA4, etc.), that is a separate consent decision and does not affect outbound click logging.

## Canonical outbound rule (non-negotiable)

Promagen must never link directly to external provider URLs from UI surfaces.

**All outbound links MUST go through:**

- `/go/{providerId}?src=<surface>`

No exceptions. This prevents drift, preserves traceability, and makes disclosure consistent.

## Provider registry: affiliate schema fields

Canonical provider data source:

- `frontend/src/data/providers/providers.json`

Current fields (observed):

- `id` (string)
- `name` (string)
- `website` (string URL)
- `affiliateUrl` (string URL | null)
- `requiresDisclosure` (boolean)
- plus ranking/prompt metadata (score/trend/tip/etc.)

### Recommended schema extension (backwards compatible)

Keep your existing fields, but add an `affiliate` object so programmes can be configured cleanly and allowlisted explicitly.

Example (recommended):

```json
{
  "id": "example",
  "name": "Example AI",
  "website": "https://example.com",
  "affiliateUrl": "https://partner.example.com/r/abc",
  "requiresDisclosure": true,
  "affiliate": {
    "enabled": true,
    "programme": "Impact",
    "clickIdParam": "click_id",
    "allowHosts": ["example.com", "partner.example.com"],
    "defaultUtm": {
      "utm_source": "promagen",
      "utm_medium": "affiliate",
      "utm_campaign": "ai_providers",
      "utm_content": "example"
    }
  }
}
Notes:

affiliateUrl remains supported for compatibility.

affiliate.allowHosts is the explicit allowlist (prevents open-redirect exploitation if provider URLs are edited).

affiliate.clickIdParam allows programmes that require a custom parameter name.

Redirect endpoint: /go/[providerId]
File:

frontend/src/app/go/[providerId]/route.ts

Behaviour
Validate providerId exists in registry.

Choose destination:

If provider has affiliateUrl (or affiliate.enabled === true), prefer that.

Else use website.

Enforce allowlist:

Destination host must match the provider’s allowlist.

If no explicit allowlist exists, allow only the host(s) derived from website and affiliateUrl.

Generate server click_id (UUID).

Append tracking params to the outgoing URL:

click_id=<uuid> (always)

UTMs (defaults, plus allow override from request query)

Write a cookie-free log record to Postgres (raw activity events), keyed by click_id.
(Optional) Mirror to KV keyed by click_id for short-term debugging only.

Return 302 redirect with Cache-Control: no-store.
Security + privacy headers (recommended)
#### Event taxonomy (authoritative)

For `/go/...` and any future usage pipeline events, `eventType` must be one of (with default weights):

- `open` (weight 1) — outbound click/open
- `click` (weight 1) — legacy alias for `open` (avoid introducing new uses)
- `submit` (weight 3) — user submitted a prompt/form
- `success` (weight 5) — confirmed success

If you need a new `eventType`, update the taxonomy + aggregation in the same change.

#### Guardrails (truth > vanity)

- Deduplicate by `sessionId` (one person = one session) so refreshing doesn’t create “phantom users”.
- Only heartbeat when the page is visible (avoids inflated “online” from background tabs).
- Weight “submit/success” more than “click/open” so browsing doesn’t dominate usage.
- Optionally exclude obvious bots (no JS, impossible event rates, known bot signatures, etc.).
- Cron aggregation must be idempotent + backfillable by design (upsert + protected “run now” trigger).

- Add: Referrer-Policy: strict-origin-when-cross-origin
- Add: X-Robots-Tag: noindex, nofollow

Implementation note (Next.js)
Some redirect Responses can have immutable headers at runtime.
Set headers when constructing the redirect response (do not call response.headers.set after creating the redirect).

Query parameters accepted by /go
Required:

none

Optional:

src (surface identifier, e.g. leaderboard, provider_detail)

utm_source, utm_medium, utm_campaign, utm_content (optional overrides)

What we log (privacy-minimal)
Log record (recommended fields):

clickId (string)

providerId (string)

isAffiliate (boolean)

requiresDisclosure (boolean)

src (string)

createdAt (ISO string)
eventType (string) — e.g. "click_open" (low-weight activity)

sessionId (string) — random, anonymous, client-generated; not identifying (no IPs)

countryCode (string) — 2-letter ISO from edge geo headers (not an IP)

isBot (boolean, optional) — server-derived flag (store the flag, not raw UA/IP)

destinationHost (string)

destinationPath (string)

destinationHash (sha256 of full URL, optional)

utm (object with source/medium/campaign/content)

We do NOT log:

cookies (none set)

IP address

full user agent

referrer
How this feeds “Promagen Users” + “Online Now” (truthful metrics)

These guardrails apply to any metric derived from activity events (including future Online Now presence):

- Deduplicate by sessionId (one person = one session) so refresh spam doesn’t inflate counts.
- Weight “submit/success” more than “click/open” so browsing doesn’t dominate usage.
- Optionally exclude obvious bots (no JS, impossible event rates, known bot signatures, etc.).
- If countryCode/sessionId can’t be trusted/derived, the UI must render blank rather than guess.

Traceability model (how money reconciles cleanly)
Ideal:

Programme supports a “sub id / click ref” parameter.

Promagen sets that parameter to click_id.

Conversions can be matched 1:1.

Fallback:

Programme does not support sub id.

Use UTMs + timestamp window + provider + src surface counts.

Disclosure wording (UI)
Table/page header (recommended)
“Some links are affiliate links. If you sign up via them, Promagen may earn a commission (at no extra cost to you).”

CTA label (near buttons/links)
Use a short label near outbound CTAs where affiliate applies:

“Try (affiliate)”
or

“Try — affiliate link”

If the provider is not affiliate-enabled:

“Visit site”

Rule:

If requiresDisclosure is true, show the disclosure + CTA label.

If false, still route through /go but disclosure label can be omitted.

Test plan (lock-in, minimum set)
Add at least these lock-in tests (must stay green):

/go returns 404 for unknown provider.

/go prefers affiliateUrl when present.

/go appends click_id and UTMs to destination URL.

/go writes KV log keyed by the exact click_id used in the redirect.

/go does not set cookies and returns Cache-Control: no-store.

UI (Leaderboard + Provider Detail) outbound CTAs contain /go/{id}?src=... and do not contain external domains.

Acceptance criteria (definition of done)
All outbound provider links from UI surfaces use /go/{providerId}?src=....

/go enforces allowlist and is open-redirect resistant.

A click_id is always generated server-side and logged without cookies.

UTMs are appended consistently.

At least 5 lock-in tests exist and pass.

pnpm run lint, pnpm run typecheck, and pnpm run test:ci pass.

```
