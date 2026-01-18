Promagen — Dynamic /api/indices (Free vs Pro) + Drift-Proof SSOT Contracts (Amended Spec)

This document is a rewritten and tightened version of “Dynamic \_api_indices Implementation for Free vs Pro Users”, updated to prevent drift, preserve ordering semantics, and close the main security weakness in the original plan.

0. What this spec guarantees
   Behaviour (must never drift)

Free users (and anonymous): /api/indices always reflects the ordered IDs in:
frontend/src/data/exchanges/exchanges.selected.json.

Pro users: /api/indices always reflects the signed-in user’s Clerk metadata:
publicMetadata.exchangeSelection.exchangeIds, on every poll/session.

SSOT rules:

No hardcoded defaults anywhere (no “first N”, no flags-as-defaults).

Strict membership validation against the SSOT catalogue.

Preserve order exactly.

Reject unknown IDs with 400; never silently drop, substitute, or “best effort”.

Security rules:

Pro selection must not be passed from the browser via query params.

Pro selection must be resolved server-side, then forwarded server-to-server to the Fly gateway using the existing gateway secret.

No secrets in responses, logs, or client bundles.

Existing behaviour preserved:

Polling schedule stays as-is.

Ribbon UI remains unchanged.

Gateway caching principles remain intact.

“No demo prices” remains intact.

1. Key amendments vs the original PDF
   Amendment A — Remove query-param forwarding of exchangeIds

The PDF proposes that the Next.js /api/indices proxy forwards exchangeIds via query parameters. That makes the user’s paid selection client-controlled, and it also creates a cheap “enumerate paid selections” surface (even if the gateway validates membership).

New rule: the browser never sends exchangeIds at all. The server reads Clerk metadata and applies it.

Amendment B — Never sort IDs for cache keys (order is meaningful)

The PDF suggests sorting IDs “for key consistency”. That breaks your “preserve order” requirement and conflicts with your paid-tier rule that selection is scope-only while ordering remains a first-class, explicit signal.

New rule: cache keys must treat order as part of the identity of the request.

Amendment C — Make drift impossible to hide

The PDF correctly suggests Zod validation for SSOT JSON shape.
This spec extends that to:

runtime validation at route boundaries,

cross-file integrity checks (selected IDs must exist in catalogue and must have Marketstack benchmark mapping),

clear failure modes that force correction at the SSOT source.

Amendment D — Align to your existing gateway model: GET for free, POST for paid

The PDF describes a query-param driven gateway selection model.
Your existing gateway already has a stronger pattern: free is a cacheable GET, paid is a secret-protected POST. This spec standardises on that pattern.

2. SSOT: single source of truth (frontend owns it)
   SSOT files

Catalogue (full universe):
frontend/src/data/exchanges/exchanges.catalog.json

Free default selection (ordered list):
frontend/src/data/exchanges/exchanges.selected.json

SSOT invariants (must be enforced)

Every ID in exchanges.selected.json.ids:

exists in exchanges.catalog.json

has a usable Marketstack mapping (marketstack.benchmark and marketstack.indexName)

Free defaults are the only defaults.
The gateway must not invent defaults or fall back to “first N”.

Drift-proofing strategy

Zod schema validates shape (types + runtime contract).

Integrity checks validate meaning (selected IDs are valid and mapped).

When invalid: fail loudly at the SSOT boundary (the config endpoint), so the problem cannot become “mysterious runtime behaviour”.

3. Replace handwritten JSON .d.ts with Zod schemas + inferred types

The PDF includes an exchanges.schema.ts design with ExchangeSchema, ExchangeCatalogSchema, and SelectedExchangesSchema.

What to replace (recommended)

Replace handwritten .d.ts used to type SSOT JSON imports (catalogues, selected lists, picker config JSONs) with:

Zod schema file colocated with the SSOT data domain, e.g.

frontend/src/data/exchanges/exchanges.schema.ts

TS types inferred from the schema:

export type Exchange = z.infer<typeof ExchangeSchema>

export type SelectedExchanges = z.infer<typeof SelectedExchangesSchema>

What not to replace

Keep .d.ts where they serve non-SSOT purposes, such as:

module augmentation,

patching third-party library typing,

global ambient types.

Enforcement points (so nobody “forgets to parse”)

Parse SSOT JSON inside the API config route (/api/indices/config) every time it runs.

Optionally, add a build/test step that imports and parses the SSOT JSON so invalid SSOT fails CI early.

4. Frontend endpoints (Next.js)
   4.1 /api/indices/config — SSOT config endpoint for the gateway

Purpose: Provide the gateway with:

the full catalogue (with mappings),

the ordered free defaults,

provenance metadata to support cache invalidation and troubleshooting.

The PDF describes this endpoint returning full exchanges plus default list and metadata like version and generatedAt.

Response contract (must remain stable)

version: integer schema version (bump only for breaking changes)

generatedAt: ISO timestamp

ssot: string pointer to the canonical file path (for humans)

defaultExchangeIds: string[] ordered list from exchanges.selected.json

exchanges: array of catalogue entries required by the gateway to map to provider symbols

Drift controls (must be implemented)

Zod parse both JSON files.

Validate each selected ID exists in the catalogue and is mapped for indices.

Reject (throw) on invalid SSOT; do not filter away errors.

4.2 /api/indices — tier-aware, secure proxy to the Fly gateway

The PDF originally makes /api/indices a proxy that forwards query parameters (including exchangeIds).
This spec replaces it with a server-resolved selection model.

Inputs

Browser sends no exchange IDs.

Server determines tier and selection by reading Clerk session + metadata.

Behaviour

Free/anonymous request path

Call Fly gateway using GET /indices

Return response

Allow cacheable headers appropriate for free content (public/shared caching)

Pro request path

Read publicMetadata.exchangeSelection.exchangeIds

Validate it strictly:

array of strings

meets min/max constraints

all IDs exist in the SSOT catalogue (membership)

Forward to Fly gateway using POST /indices

include x-promagen-gateway-secret

include exchangeIds in JSON body

Return response with:

Cache-Control: private, no-store (personalised content)

never leak selection or internal IDs beyond what’s already in the response data

Error handling (must be explicit)

Invalid/malformed metadata selection: 400

Unknown IDs: 400 (list a few invalid IDs; don’t echo arbitrarily large lists)

Unauthenticated but “paid path attempted”: treat as free (or 401, depending on your auth model), but be consistent across feeds.

5. Client hook (useIndicesQuotes) — preserve UI behaviour, enforce security

The PDF updates the hook to:

choose default vs paid IDs based on tier,

poll /api/indices with or without exchangeIds query param.

This spec changes only the transport, not the UI behaviour.

Hook rules (unchanged UX, safer transport)

Keep the same polling schedule and rendering behaviour.

Maintain “skeleton quotes” initialisation.

Do not construct URLs with exchangeIds.

Hook transport behaviour

Free: fetch /api/indices with credentials: 'omit' (max cacheability)

Pro: fetch /api/indices with credentials: 'include' so the server can read the session cookies and resolve metadata server-side.

6. Gateway /indices behaviour (Fly gateway)

The PDF proposes a gateway route that:

reads exchangeIds from query params,

validates membership,

enforces min/max,

builds a cache key by sorting IDs.

This spec uses the stronger pattern:

GET /indices → free defaults only

POST /indices (secret-protected) → paid selection

6.1 Free defaults (GET /indices)

Only uses SSOT-provided defaults from /api/indices/config.

Must preserve the SSOT ordering from exchanges.selected.json.

Must not accept user selection via query param.

6.2 Paid selections (POST /indices)

Requires x-promagen-gateway-secret.

Validates:

tier is paid (or equivalent)

exchangeIds array format

min/max exchange count (as per your paid tier spec)

membership against the gateway’s in-memory catalogue map (loaded from SSOT config)

6.3 Cache keying (order-preserving, drift-resistant)

The PDF is correct that caching should separate different selections and that SSOT changes should invalidate cache.
But it must be done without sorting.

Cache key must incorporate:

feed id (indices)

SSOT fingerprint (see below)

ordered exchange ID list (joined with a stable delimiter)

SSOT fingerprint

Use a stable fingerprint derived from the config payload:

ideally a content hash over defaultExchangeIds + exchanges[].id + exchanges[].marketstack.benchmark

or a version + generatedAt pair if you prefer human-friendly debugging, but a hash is more robust.

6.4 Budgeting + “no demo prices”

Keep existing rules:

TTL caching (2 hours)

stale-while-revalidate / single-flight / dedupe

never return demo prices; return null prices so UI renders “—”

The PDF explicitly calls for null-price fallback on failure.

7. Security posture (anti-hack checklist)
   7.1 Never trust the browser for paid selection

No exchangeIds in query params.

No exchangeIds in request body from the client.

No “tier=paid” from the client.

7.2 Secrets

x-promagen-gateway-secret:

must exist only on server-to-server calls

must never be logged

must never be present in frontend bundles

7.3 Fail-closed in production

If the gateway secret is missing in a production environment, the paid endpoint must fail (401/500), not silently accept requests.

7.4 Input hardening

Clamp and validate:

ID format (^[a-z0-9-]{3,30}$)

max body size

reject extremely large selections early

7.5 Caching isolation

Free responses: cacheable and shareable.

Paid responses: private, no-store/no-cache.

Do not allow a paid response to be cached under a public key.

8. Tests and verification (drift + security)

The PDF includes tests around:

valid custom selection,

rejecting invalid IDs,

enforcing min/max,

caching behaviour.

This spec keeps those goals but updates the test surface to match the new security model.

8.1 Free SSOT change test

Modify ordering in exchanges.selected.json (swap two IDs).

Hit /api/indices as anonymous/free.

Confirm returned data order matches SSOT ordering exactly.

8.2 Pro selection change test (server-resolved)

Set Clerk metadata publicMetadata.exchangeSelection.exchangeIds to an ordered list.

Sign in as Pro and load the page.

Confirm /api/indices reflects that exact ordering.

Change metadata ordering; confirm the next poll reflects the change without redeploy.

8.3 Rejection tests (no silent fallback)

Put an unknown ID in metadata → expect 400.

Use too few or too many IDs → expect 400.

Remove Marketstack mapping for a selected exchange in the catalogue → expect /api/indices/config to fail loudly (prevents hidden drift).

8.4 Cache correctness

Two different ordered selections must map to two distinct cache entries.

Same IDs in different order must be treated as different requests (ordering is intentional).

9. Operational metadata (provenance and debugging)

Every indices response (frontend proxy and gateway) should include enough provenance to answer:

Which SSOT version/fingerprint was used?

Was this served from cache?

Which exchange IDs were requested (especially for paid)?

Minimum recommended fields in meta:

ssotSource (url or identifier)

ssotVersion (integer)

ssotGeneratedAt (ISO)

ssotFingerprint (hash string)

mode (live | cached | fallback)

requestedExchanges (ordered IDs actually used)

10. Migration plan (non-breaking rollout)

Introduce Zod schemas for exchanges SSOT (catalogue + selected).

Update /api/indices/config to:

parse with Zod,

enforce integrity checks,

include fingerprint.

Update gateway indices loader to:

store SSOT fingerprint,

use strict defaults,

preserve ordering.

Update /api/indices to:

resolve tier + selection server-side via Clerk,

call gateway with GET for free, POST+secret for paid,

set correct cache headers.

Update useIndicesQuotes transport:

remove exchangeIds from URL,

use credentials include for Pro.

Remove/retire handwritten .d.ts for SSOT JSON imports that the schemas now cover.

11. Non-goals (explicitly out of scope)

Changing the ribbon UI layout or UX.

Changing Marketstack symbol mapping strategy.

Adding new provider features.

Reworking the broader SSOT artefact pipeline (unless you choose to later).

12. Summary of what drift-proof “done” looks like

SSOT shape is validated (Zod).

SSOT meaning is validated (integrity checks).

Free indices always reflect exchanges.selected.json order.

Pro indices always reflect Clerk metadata order.

No exchange IDs travel from browser to backend.

Unknown IDs are rejected with 400, always.

Caching is selection-aware and order-aware.

Paid responses are never cache-shared.

Provenance metadata makes debugging trivial.
