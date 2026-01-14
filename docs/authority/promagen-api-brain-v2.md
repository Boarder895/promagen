Promagen API Brain v2 — Registry + Policies (SSOT + Cost-Control)
**Book 1 of 2** | Sections §0–§22  
**Book 2:** `promagen-api-brain-v2-book2.md` | Sections §23–§26 (Provider-Based Gateway Architecture)
Purpose: A single, explicit, testable set of rules for how Promagen selects providers, controls spend, caches responses, slices workload, and exposes trace data — without letting UI polling or widget count accidentally drive upstream cost.
Monetisation scope note (keep docs separated)
This document defines API authority, provider behaviour, and cost-control.

It does NOT define what users get for free vs paid.
That contract lives only in:
`C:\Users\Proma\Projects\promagen\docs\authority\paid_tier.md`

Hard rule: if it is not written in `paid_tier.md`, it is free.

0. Revision notes (why v2 exists)

This document exists because the ribbons only feel "alive" if the system is calm, predictable, and honest.

If you only remember one thing:

You don't just need rules. You need authority.
A system without a gatekeeper will always "helpfully refresh" and quietly burn credits.

v2 is designed to remove implicit assumptions by:

declaring cost-control constraints as non-negotiable rules

making A/B timing explicit (no more "it was implied")

making trace endpoints read-only by contract

forcing SSOT-aware cache keys so config changes invalidate correctly

separating client polling frequency from upstream provider frequency

embedding the FX Authority Map (decision authority) so regressions are obvious

embedding the FX NO-BYPASS CHECKLIST (audit tool) and PR review template so authority cannot silently regress

**v2.4.0 update (Jan 12, 2026):** Extended architecture to three feeds (FX, Commodities, Crypto) with identical calming, API timing stagger to prevent rate limits, and removed UI budget emoji indicator.

1. Core principle: rules must be enforceable

Promagen must contain exactly one authority point in the server request path that is empowered to decide:

"Serve cache; do nothing."

"Refresh exactly one group."

"Refuse upstream because it is forbidden right now."

"Ride-cache because upstream failed / rate-limited."

If this authority does not exist (or is bypassable), everything else becomes wishful thinking.

2. SSOT: what the ribbons are allowed to show

Each ribbon's data list is SSOT and lives at:

- **FX:** `frontend/src/data/fx/fx-pairs.json`
- **Commodities:** `frontend/src/data/commodities/commodities-catalog.json`
- **Crypto:** `frontend/src/data/crypto/crypto-catalog.json`

These files are SSOT for:

which items appear on the ribbon

their order (used for deterministic A/B split)

any classification used for thresholds

SSOT changes must invalidate caches immediately. No waiting for TTL to "eventually" reflect config changes.

3. Registry vs policies: single source of truth

Promagen uses:

config/api/providers.registry.json
declares providers, endpoints, capabilities, env var dependencies, and metadata

config/api/roles.policies.json
declares routing policy per role (FX, commodities, crypto, etc.), including fallback chains and caching rules

The registry describes what exists.
The policy describes how it's used.

No code should hardcode provider lists or fallback ordering outside these files.

3.1 Minimum schema expectations (registry + policy) — so the Brain is actually enforceable

This section does not prescribe a JSON schema implementation. It defines the minimum information that must exist so the system is deterministic and testable.

3.1.1 providers.registry.json (minimum fields)

Each provider entry should be able to answer:

Identity

- id (stable string key)
- name (human readable)
- website or docs (optional, but useful)
- notes (optional)

Auth / configuration

- required env vars (names only; never values)
- whether missing env vars means "provider unavailable"

Capabilities

- roles supported (e.g. fx.ribbon, commodities.ribbon, crypto.ribbon)
- bulk support (true/false)
- max symbols per bulk request (or "unknown")
- known provider rate-limit hints (optional; enforcement still belongs to the Gate)

Endpoints (as needed)

- base URL
- route templates for bulk quotes
- any required query params

Normalisation expectations

- quote mapping keys (e.g. symbol format)
- time fields if provided (asOf)

  3.1.2 roles.policies.json (minimum fields)

Each role policy should be able to answer:

Identity

- role id (e.g. fx.ribbon, commodities.ribbon, crypto.ribbon)
- description (optional)

Caching & calm rules (normative)

- ttlSeconds (authoritative TTL enforced server-side)
- bulkOnly (must be true for all ribbon roles)
- singleFlightKeying rules (payload identity; must include SSOT fingerprint)

Provider chain (normative)

- primary provider id
- backup1 provider id (optional)
- backup2 provider id (optional)
- whether fallback is allowed when primary is forbidden vs only when it fails

Ribbon specifics (normative; v2 default is primary-only and no cross-provider fallback)

- SSOT source path
- A/B split rule (even/odd indices)
- alternation rule (A then B then A…)
- cold-start priming enabled (true/false; default true for ribbon roles)
- **refresh slot** (for API timing stagger — see §21.2)

Safety rails (normative)

- ride-cache behaviour on failure/429
- budget guard behaviour (warn/block thresholds and caps)

4. Roles: what "role" means

A role is a logical data capability: e.g.

fx.ribbon
fx.trace
commodities.ribbon
commodities.trace
crypto.ribbon
crypto.trace

Roles have policies describing:

which providers can serve them (priority chain)

what caching rules apply

what behaviour is forbidden (budget blocks, missing-key blocks, trace read-only, etc.)

4.1 API Surface Index (routes → roles)

This document started as a cost-control + authority spec (the "Brain"), not a full endpoint reference.
That's why earlier versions felt "complete" for FX but still left gaps for other endpoints.

This section fixes that by listing the API surface as it exists in the repo, and by forcing every route to declare:

- the logical role it belongs to
- whether it is governed by the Brain (registry + policies + Gate-owned spend control), or is a separate subsystem
- its caching / TTL promise (if any)
- whether it has a trace/diagnostics sibling endpoint

Important rules:

- If a route can trigger paid upstream calls, it MUST be Brain-governed and MUST route through a Refresh Gate.
- If a route is not Brain-governed, it MUST NOT quietly grow upstream spend later without being migrated under a Gate and given a role policy.
- This table is an index. The enforcement still lives in code + policies.

API Surface Index (derived from frontend/src/app/api/\*\*/route.ts):

| Route                              | Role (logical)      | Gate / Brain owned?   | TTL / caching (declared) | Trace/diagnostics?            | Notes                              |
| ---------------------------------- | ------------------- | --------------------- | ------------------------ | ----------------------------- | ---------------------------------- |
| /api/admin/catalog/backups         | admin               | No (admin)            | no-store                 | No                            | Admin operations                   |
| /api/admin/catalog                 | admin               | No (admin)            | no-store                 | No                            | Admin operations                   |
| /api/admin/ping                    | admin               | No (admin)            | no-store                 | No                            | Admin operations                   |
| /api/audit                         | audit               | No (audit)            | varies                   | No                            | Audit log / verification           |
| /api/audit/[id]/csv                | audit               | No (audit)            | varies                   | No                            | Audit log / verification           |
| /api/audit/[id]                    | audit               | No (audit)            | varies                   | No                            | Audit log / verification           |
| /api/audit/[id]/verify             | audit               | No (audit)            | varies                   | No                            | Audit log / verification           |
| /api/auth/\*                       | auth                | No (Clerk)            | no-store                 | No                            | DEPRECATED: Handled by Clerk       |
| /api/commodities                   | commodities.ribbon  | Yes (Refresh Gate)    | 30m (server TTL)         | Yes (via /trace)              | Commodities ribbon bulk quotes     |
| /api/commodities/trace             | commodities.trace   | Yes (observer-only)   | no-store                 | Yes                           | Commodities trace (read-only)      |
| /api/consent                       | consent             | No                    | no-store                 | No                            | Consent preferences                |
| /api/crypto                        | crypto.ribbon       | Yes (Refresh Gate)    | 30m (server TTL)         | Yes (via /trace)              | Crypto ribbon bulk quotes          |
| /api/crypto/trace                  | crypto.trace        | Yes (observer-only)   | no-store                 | Yes                           | Crypto trace (read-only)           |
| /api/exchanges                     | exchanges.index     | No (exchanges)        | varies                   | No                            | Exchange list                      |
| /api/fx                            | fx.ribbon           | Yes (Refresh Gate)    | 30m (server TTL)         | Yes (trace via sibling route) | FX ribbon bulk quotes (A/B cached) |
| /api/fx/trace                      | fx.trace            | Yes (observer-only)   | no-store                 | Yes                           | FX trace diagnostics (read-only)   |
| /api/health                        | health              | No (health)           | no-store                 | No                            | Health/ping                        |
| /api/ingest/market                 | ingest              | No (ingest)           | no-store                 | No                            | Ingestion endpoints                |
| /api/ingest/weather                | ingest              | No (ingest)           | no-store                 | No                            | Ingestion endpoints                |
| /api/meta                          | meta                | No                    | varies                   | No                            | Site metadata                      |
| /api/ping                          | health              | No (health)           | no-store                 | No                            | Health/ping                        |
| /api/providers/leaderboard/bulk    | providers.catalogue | No (static catalogue) | short/none               | No                            | Provider metadata and overrides    |
| /api/providers/resolve             | providers.catalogue | No (static catalogue) | short/none               | No                            | Provider metadata and overrides    |
| /api/providers                     | providers.catalogue | No (static catalogue) | short/none               | No                            | Provider metadata and overrides    |
| /api/providers/[id]/override/audit | providers.catalogue | No (static catalogue) | short/none               | No                            | Provider metadata and overrides    |
| /api/providers/[id]/override       | providers.catalogue | No (static catalogue) | short/none               | No                            | Provider metadata and overrides    |
| /api/ribbon                        | ribbon              | No (stub)             | varies                   | No                            | Ribbon aggregator stub             |
| /api/snapshot/market               | snapshot            | No (snapshot store)   | varies                   | No                            | Snapshot read/write                |
| /api/snapshot/weather              | snapshot            | No (snapshot store)   | varies                   | No                            | Snapshot read/write                |
| /api/snapshot/[key]                | snapshot            | No (snapshot store)   | varies                   | No                            | Snapshot read/write                |
| /api/track-click                   | analytics.track     | No                    | no-store                 | No                            | Click tracking                     |
| /api/weather                       | weather             | No (weather)          | varies                   | No                            | Weather data                       |
| /api/world-clocks                  | world-clocks        | No                    | varies                   | No                            | World clocks                       |

4.2 Roles table (what ships, and what is governed)

A roles table is the canonical map that ties the surface index to enforcement.
If a role exists, it must have:

- provider chain (from roles.policies.json)
- TTL / caching rules (server-owned)
- bulk rules (if applicable)
- a declared definition of "forbidden" for that role (freeze windows, budget rules, auth gates)
- a trace stance (observer-only, or no trace)
- **refresh slot** (for API timing stagger)

Minimum roles currently relied upon by the Brain model:

| Role id            | Primary route(s)       | Provider chain source                                                  | TTL / cache authority | Bulk rules      | Refresh slot | Forbidden means                                | Trace                             |
| ------------------ | ---------------------- | ---------------------------------------------------------------------- | --------------------- | --------------- | ------------ | ---------------------------------------------- | --------------------------------- |
| fx.ribbon          | /api/fx                | roles.policies.json → providers.registry.json (execution via adapters) | Server TTL 30 min     | Bulk-only (N→1) | :00, :30     | budget block; missing key; ride-cache cooldown | /api/fx/trace (observer-only)     |
| fx.trace           | /api/fx/trace          | none (observer-only)                                                   | no-store preferred    | n/a             | n/a          | never calls upstream; never mutates cache      | itself                            |
| commodities.ribbon | /api/commodities       | roles.policies.json → providers.registry.json (execution via adapters) | Server TTL 30 min     | Bulk-only (N→1) | :10, :40     | budget block; missing key; ride-cache cooldown | /api/commodities/trace (observer) |
| commodities.trace  | /api/commodities/trace | none (observer-only)                                                   | no-store preferred    | n/a             | n/a          | never calls upstream; never mutates cache      | itself                            |
| crypto.ribbon      | /api/crypto            | roles.policies.json → providers.registry.json (execution via adapters) | Server TTL 30 min     | Bulk-only (N→1) | :20, :50     | budget block; missing key; ride-cache cooldown | /api/crypto/trace (observer-only) |
| crypto.trace       | /api/crypto/trace      | none (observer-only)                                                   | no-store preferred    | n/a             | n/a          | never calls upstream; never mutates cache      | itself                            |

**Refresh slot** (NEW - Jan 12, 2026): Each ribbon role has assigned refresh slots to prevent simultaneous upstream calls. See §21.2 API Timing Stagger.

Runtime knobs (environment variables, server-only)

All three ribbon roles share:

- TWELVEDATA_API_KEY
- FX_RIBBON_BUDGET_DAILY_ALLOWANCE (shared across all feeds)
- FX_RIBBON_BUDGET_MINUTE_ALLOWANCE
- FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS

Per-feed TTL overrides:

- FX_RIBBON_TTL_SECONDS (default 1800)
- COMMODITIES_CACHE_TTL_SECONDS (default 1800)
- CRYPTO_CACHE_TTL_SECONDS (default 1800)

These are deployment-critical: they must be set in the hosting environment (e.g. Vercel/Fly), not only in local .env files.

Everything else in the Surface Index is either:

- already a "role" in a different subsystem (auth/audit/admin), or
- not yet migrated under the Brain (stub/static routes), or
- awaiting explicit policy entries if it will ever trigger upstream spend.

Rule (so this doesn't rot): if you add a new /api/\* route, you also add a row here (and if it can spend money, you also add it to roles.policies.json and route it through a Gate).

5. Provider chain: how fallback works

A provider chain is:

Primary provider

Backup 1

Backup 2

Optional "hard fail" (no more providers)

Promagen tries providers in order, stopping at first success, unless policy forbids upstream calls.

5.1 Provider catalogue detail (how to document providers so behaviour is predictable)

The registry file is where providers are declared, but this document must still define what "complete provider documentation" means.
A provider entry is only useful if you can answer, in one place, the questions that otherwise cause endless regressions.

Minimum provider catalogue fields (normative):

Identity

- providerId (stable string key used in code + responses)
- name (human readable)
- docs/website (optional)

Auth / configuration

- required environment variables (names only; never values)
- "missing key" semantics (does missing key disable the provider, or force unavailable?)

Capabilities

- which roles it can serve
- bulk support (true/false)
- bulk symbol limit (known numeric limit, or "unknown"; enforcement still belongs to the Gate)
- cost model hints (credits per request, per symbol, per endpoint) if known

Symbol format

- expected symbol grammar (e.g. FX "USD/JPY" vs "USDJPY")
- normalisation mapping rules (how raw provider symbols map to SSOT symbols)

Known failure modes

- rate limit responses / headers
- "success" payloads that still contain errors per symbol
- partial data (missing symbols in a bulk response)
- stale timestamps / missing asOf

Normalisation rules

- how to convert provider response into Promagen's canonical quote shape
- how to treat missing symbols (explicitly record missing in trace; never invent prices)

Concrete minimum catalogue for the current provider set (as implemented today):

Provider: twelvedata

- providerId: twelvedata
- env vars: TWELVEDATA_API_KEY (server-only)
- roles: fx.ribbon, commodities.ribbon, crypto.ribbon (all ribbon roles)
- bulk: yes (Promagen uses one bulk request per ribbon feed)
- symbol format expected by Promagen SSOT + UI:
  - FX: "USD/JPY" style
  - Commodities: "XAU/USD", "BRENT" etc.
  - Crypto: "BTC/USD", "ETH/USD" etc.
- known failure modes to treat as normal:
  - HTTP 429 / "rate limit" → Gate applies ride-cache cooldown; trace explains budget state and last decision
  - 200 OK but missing some symbols → treat as partial data; return "—" for those chips; list missing symbols in trace
  - provider latency/timeouts → treat as upstream failure; attempt fallback chain only if policy allows

Virtual providers (not upstream, but used for provenance)

- providerId: cache
  - means values were served from server cache within TTL (or ride-cache if upstream failed)
- providerId: fallback
  - means the primary provider failed and a backup provider served (only when backup chain exists)

Do not add new providers "by code only".
If you add a provider adapter, also add:

- providers.registry.json entry
- roles.policies.json references for any role that can use it
- a row (or sub-row) in this section stating env var name, symbol format, bulk limits, and known failure modes

6. Bulk-only contract (N→1)

The ribbon contract is:

The ribbon has an SSOT list of items.

The server fetches data for the ribbon in one bulk request.

It will not fetch per-item.

It will not allow N parallel requests for the same ribbon payload.

The ribbon is designed to be a "market surface language", not a per-widget data source.

6.1 Bulk representation (policy-level expectations)

For ribbon roles, "bulk" means:

- one upstream request per refresh decision (leader only)
- requesting the full set of required symbols in that request
- receiving a map keyed by symbol/pair id (or an equivalent structure)
- normalising to exactly the SSOT list (in order), with unknown prices represented explicitly (see Response Contracts)

If a provider cannot return all symbols in one request due to provider max limits, the role policy must declare the maximum and the Gate must still enforce "no extra upstream calls" per refresh decision (i.e. do not silently fall back to multiple upstream calls without an explicit policy change).

7. Single-flight: one in-flight request shared

Single-flight means:

if 10 callers request the same logical payload at the same time

only one upstream request is performed

everyone shares the same promise/result

Single-flight is a core cost-control lever and must apply at the group + payload identity level.

7.1 Single-flight scope for ribbon roles (A, B, and cold-start priming)

For each ribbon role, the Gate must maintain three distinct single-flight scopes:

- inFlightA: one leader refresh for Group A (payload identity includes SSOT fingerprint)
- inFlightB: one leader refresh for Group B (payload identity includes SSOT fingerprint)
- inFlightPrimeBoth: one leader cold-start prime that populates both groups from one bulk upstream call (payload identity includes SSOT fingerprint)

This prevents stampedes on cold start and prevents accidental double-refresh where "A refresh" and "B refresh" happen concurrently.

9. Ride-cache on failure / 429

If upstream fails:

return cached values if available

mark them as ridden/stale in trace

do not thrash upstream with retries that violate calming rules

429 handling:

treat provider 429 as a signal to ride-cache and back off

do not hammer backups immediately unless policy explicitly allows it

9.1 Budget guard (server-owned, single source of truth)

Budget guard exists to prevent a "healthy" system from going bankrupt.

Hard rule:
Budget state is computed only inside the Refresh Gate (authority). It must not be recomputed in UI, routes, or trace. Everything else receives the computed snapshot.

9.1.1 Budget caps (defaults, overrideable)

- Daily allowance: 800 calls/day (default, shared across all ribbon feeds)
- Per-minute cap: 8 calls/minute (default)

Overrides may exist via env/config, but must be applied only by the Gate.

Day boundary must be Europe/London local day (not server UTC).

9.1.2 Budget states and thresholds (safety margin rule)

Budget.state must be one of:

- ok (below warning threshold AND below minute cap)
- warning (at or above ~70% of daily allowance, but not blocked)
- blocked (at or above ~95% of daily allowance OR minute cap is hit)

The thresholds are a safety margin:

- warning at ~70%
- block at ~95%

  9.1.2.1 Budget state is server-only (UPDATED Jan 12, 2026)

Budget state is an **operational metric**, not a user-facing indicator.

**What was removed (Jan 12, 2026):**

- Budget emoji indicator (🛫/🏖️/🧳) from ribbon UI
- `emoji-bank.json` budget_guard group
- Budget emoji passthrough in API responses

**Rationale for removal:**

- Added visual clutter to a clean ribbon design
- Budget state is operational concern, not user-facing
- Monitoring via `/health` and `/trace` endpoints is sufficient
- Conflicts with the minimal, professional ribbon aesthetic

**What remains:**

- Budget state computation in the Gate (unchanged)
- Budget state in `/health` and `/trace` responses (unchanged)
- Budget enforcement (warn/block thresholds)
- Logging of budget warnings/blocks

Budget state is now exposed **only** through:

- `/health` endpoint → `budget.state`, `budget.dailyUsed`, `budget.minuteUsed`
- `/trace` endpoints → `budget` snapshot
- Server logs → warnings when approaching limits

  9.1.3 Enforcement rules (non-negotiable)

When Budget.state is blocked:

- absolutely no upstream/provider calls for any ribbon role (including cold-start priming)
- serve cache only (fresh or ridden)
- if no cache exists, return an honest degraded response with unknown prices (see Response Contracts)

When Budget.state is warning:

- upstream is still allowed (subject to TTL/freeze/cooldown)
- trace and meta must surface warning clearly so the system is observable

  9.1.4 Exposure rules (meta + trace + headers)

The Gate's computed budget snapshot must be passed through to:

- /api/{feed} response meta (budgetState + counters useful for observability)
- /api/{feed}/trace payload (same snapshot)
- response headers (optional, but useful for ops)

No other file should compute or infer budgetState.

**Note:** Budget state is NOT exposed as UI emoji (removed Jan 12, 2026).

9.2 Non-FX budget rules (role-scoped, not FX-shaped by accident)

The budget machinery in Promagen exists to stop "helpful refresh" from becoming an invoice.
FX shaped the design, but the rule is global:

Budget is a Gate-owned decision, and it is role-scoped.

If a different role has a different cost model, it must declare that model explicitly, otherwise you will accidentally enforce the wrong thing.

Examples of cost model differences you must document per role:

- "credits per request" (flat)
- "credits per symbol" (bulk call cost scales with N)
- "credits per endpoint" (one provider has multiple endpoints with different prices)
- "free tier vs paid tier" (free-tier limits vs paid entitlements behaviour)

Normative rule:

- Each role policy declares (or references) its cost model (even if the model is "flat per call").
- The Gate computes a single shared budget.state (ok/warning/blocked) across all ribbon roles, and that one state is what trace/headers reflect.
- Warning and block thresholds must use your margin rules (warn ~70%, block ~95% of the declared allowance), but the exact allowances remain role-defined.

If a role has no budget policy, that is still a policy: it must say "no budget enforcement" explicitly, otherwise the implementation will drift.

10. Trace endpoints: observation only

Trace endpoints are for observation, not action.

/api/fx/trace, /api/commodities/trace, /api/crypto/trace must never trigger upstream refresh.

They must expose:

cache timestamps

last refresh group

which group would be eligible now

provider health / fallback history

whether upstream was called for the request (it should be no for trace)

10.1 Trace caching rule

Trace is diagnostics. It should generally be returned with no-store semantics (or equivalent) so caches/CDNs do not serve misleading debug state.

11. Cache policy: why we cache

Ribbon endpoints can be surprisingly expensive on plan limits.
Caching reduces spend, smooths traffic, and improves perceived performance.

But the deeper reason is structural:

Caching is how we create authority.
If the system can always say "use what we already know", it can also say "no, not yet".

12. Cache TTL: the rule

Cache TTL is defined in the role policy.

Two consequences follow, and they are non-negotiable:

Server TTL is authoritative.
If the server says the TTL has not expired, upstream must not be called — regardless of client polling.

Cache headers must be honest.
If the server TTL is 30 minutes, we do not emit headers implying 5 minutes "freshness" (or vice versa).
CDN behaviour must match what the server is prepared to enforce.

13. Cache layers (what is cached, and at what granularity)

Promagen's ribbon caching is intentionally layered:

Layer A — Group caches (A and B)

Stores the last successful upstream response for each A/B group.

Each group cache has its own timestamp and TTL decision.

On a refresh cycle, at most one group is eligible to refresh.

Layer B — Merged ribbon cache

Stores a merged A+B payload that the UI consumes.

The merged payload is derived from the latest known Group A and Group B data (fresh or ridden cache).

The merge step never triggers upstream on its own; it only assembles what exists.

Layer C — Trace cache (read-only)

The trace endpoint reads existing cached state and recent refresh decisions.

Trace must never "helpfully" trigger a refresh. It is observation only.

This layering is what makes "merged A+B response" compatible with "only one group refreshes per refresh cycle".

13.1 Cache object schema (normative) — what each layer must contain

This section defines minimum fields the system must track so the behaviour is testable and debuggable.

13.1.1 Group cache entry (A or B)

A group cache entry must carry:

Identity

- role (fx.ribbon, commodities.ribbon, or crypto.ribbon)
- groupId (A or B)
- ssotFingerprint (hash/fingerprint of ordered SSOT ids)

Quote payload (normalised)

- quotes: map keyed by SSOT id, where each quote contains:
  - itemId
  - price (number) OR null (explicit unknown)
  - asOfMs (number; epoch ms)
  - providerId (string)
  - mode (live | cached | blocked | frozen | degraded) as a label for observability; only include "fallback" when backup providers are explicitly enabled for the role
  - stale (boolean; true when ridden cache or forbidden-state output)
  - optional: errorTag (short string) when price is null due to error/forbidden

Timing

- storedAtMs (when written)
- expiresAtMs (TTL-based expiry time for this group entry)

Flags (authority-only)

- seeded (boolean; see Cold-start priming and alternation invariants)
- rodeCache (boolean; set when this entry was served due to upstream failure/429, not because it was within TTL)

Diagnostics (optional but recommended)

- lastError (short string) when the last attempted refresh failed
- lastStatusCode (number) when provider returned HTTP error

  13.1.2 Merged ribbon response (assembled view)

Merged ribbon output must:

- preserve SSOT order
- include all SSOT items (never drop items)
- for each item include price or explicit unknown (null)

Merged output may be:

- assembled on request from group caches, or
- stored as a derived cache entry

If stored, its cache identity must still include the ssotFingerprint and must not introduce new upstream work.

14. Cache keys: SSOT-aware, deterministic, safe

To honour SSOT as the single source of truth, caching must be SSOT-aware.

Promagen must ensure cache keys incorporate the SSOT ribbon set identity, so that:

Changing the SSOT file invalidates the cached ribbon result immediately

You never have to wait for TTL to see a config change reflected

Two different ribbon configurations can never share a cache entry by accident

Policy-level expectations:

Cache key must include:

- role id (fx.ribbon, commodities.ribbon, crypto.ribbon)
- SSOT fingerprint (ordered list identity)
- groupId (A or B) for group caches

Cache key must NOT include:

- request timestamp
- random values
- any transient state

15. Response contracts: what the UI receives

Each ribbon endpoint must return:

meta

- mode (live | cached | degraded)
- ssotSource (frontend | fallback)
- budget snapshot (state, dailyUsed, minuteUsed) — NOT as emoji

data

- ordered list matching SSOT
- each entry contains itemId, price, asOfMs, providerId

16. Forbidden actions (the "never do this" list)

These behaviours must never happen:

- Per-item upstream calls (must always be bulk)
- Trace triggering upstream
- Client timers controlling upstream
- Bypassing budget blocks
- Multiple ribbon requests for same payload in parallel
- Cache key ignoring SSOT fingerprint

17. Authority contract addendum: making cost-control enforceable

This addendum is the operational contract that ties together registry + policies + server enforcement and makes the "calming rules" testable.

17.1 What problem this addendum solves (context)

You have rules, but you do not have authority.
Nothing in the system is empowered to say "no, not yet" to an upstream call.

17.2 The Refresh Gate (single authority point)

The Refresh Gate is the only thing allowed to decide upstream work for all ribbon roles.

It must enforce:

TTL (production: 30 minutes for all ribbon roles)

A/B slicing and deterministic selection

Single-flight per group + payload identity

Budget guard (warn/block)

API timing stagger (different refresh slots per role)

Cache headers must reflect the server TTL policy for edge friendliness (without lying about freshness).

All trace endpoints must remain read-only (no upstream calls), and must expose the diagnostics required to explain failures.

17.2.1 API calming rules (canonical list — non-negotiables)

These are the full set of calming rules you have been enforcing. They are listed here as a single checklist so we can point tests at them and stop "accidental spend" caused by UI polling, widget count, or well-meaning refresh logic.

Server-side behaviour (authority, caching, spend):

Server-side TTL caching (no upstream calls within TTL)

TTL is authoritative (client polling must not imply upstream frequency)

Single-flight upstream requests (one in-flight call shared)

Bulk-only requests (N→1, never per-item)

Explicit ban on N parallel calls (one bulk request only)

API timing stagger (each role refreshes at assigned slots — see §21.2)

A/B slicing and refresh rhythm:

Group A / Group B slicing (refresh only half the symbols per refresh cycle)

Deterministic group selection (no random or request-driven choice)

A/B alternation (same group must not refresh twice in a row)

A/B switching only on TTL expiry (no mid-TTL refresh)

"Only one group refreshes per refresh cycle" (the enforcement point)

Client behaviour (polling, widgets, perception):

Centralised client polling (multiple widgets ≠ multiple API calls)

Client polling decoupled from upstream refresh

No client-side timers controlling upstream

No cron-driven upstream refresh

No per-request "always refresh" behaviour (requests must be able to be served from cache)

Failure handling / safety rails:

Ride-cache on provider failure / HTTP 429

Trace endpoint read-only (must never trigger upstream)

Upstream auth strictly server-side

SSOT and output guarantees:

SSOT-keyed cache invalidation (SSOT change forces new cache)

Merged A+B response (always show full ribbon set)

CDN-honest cache headers (reflect server TTL, no lying)

These rules must be simultaneously true — and the Refresh Gate is the only thing allowed to decide upstream work.

17.2.2 Authority layer: the Refresh Gate ("no, not yet")

The problem in one sentence:

You have rules, but you do not have authority.
Nothing in the system is empowered to say "no, not yet" to an upstream call.

To fix this properly, Promagen must have exactly one server-side authority point (the Refresh Gate) that decides, for every ribbon request:

"Serve cached; do nothing upstream."

"Refresh exactly one A/B group (bulk, single-flight)."

Upstream is forbidden right now (policy/budget) — serve cache only.

"Upstream failed / 429 — ride-cache and back off."

That is why you do not need an explicit 'time between A and B' timer in application code: the Gate enforces time using cache timestamps + TTL + deterministic group eligibility.

Non-negotiable responsibilities of the Refresh Gate:

Know the rules (from SSOT + role policy)

TTL (current production: 30 minutes for all ribbon roles)

A/B slicing and deterministic selection

"Only one group per refresh cycle"

Single-flight (one in-flight promise per group + payload identity)

Budget guard (warn/block thresholds and caps; computed once)

API timing stagger (enforce refresh slots)

Decide whether upstream is allowed

If request is trace → upstream is never allowed

If budget is blocked → upstream is never allowed (including priming)

If group cache is within TTL → upstream is not allowed ("no, not yet")

If upstream recently failed / returned 429 → upstream may be temporarily denied and we ride-cache

Guarantee the cost model

A client can poll any ribbon endpoint every 2 seconds and it must not change upstream spend.

Multiple widgets mounting must not multiply network calls (client-side centralisation) and must not multiply upstream calls (server-side gating + single-flight).

Return something sane in every outcome

Fresh merged A+B response when a refresh happened

Warm cached merged response when TTL is valid

Stale-but-usable merged response when upstream is down (with trace flags showing it is stale/rode-cache)

Honest degraded response when upstream is forbidden and cache is empty (unknown prices, not missing items)

18. Testing expectations (must prove calming rules)

Promagen must have tests that prove:

multiple widget mounts do not cause multiple API calls per feed

repeated polling does not cause upstream spend within TTL

group alternation is deterministic

same group does not refresh twice in a row

cold-start priming:

- when both caches empty and upstream allowed, first response includes full SSOT set with prices populated (where provider returns prices)
- uses exactly one upstream bulk call
- uses single-flight under concurrency
- seeded cache does not stall alternation

budget blocked forbids upstream (including priming)

trace never triggers upstream

SSOT change invalidates cache key

bulk-only contract is maintained (no per-item upstream calls)

single-flight is active under concurrency

API timing stagger is respected (each feed refreshes at its assigned slots)

19. Client contract (ribbons)

19.1 Centralised polling

One poller for each ribbon feed.

Widgets consume shared state.

Polling frequency does not imply upstream frequency.

19.2 Reduced motion

Respect reduced-motion preferences.

If reduced motion is enabled, animation must soften or disable.

**Note (Jan 12, 2026):** The global "pause button" UI element has been removed from all ribbons. Motion control now relies entirely on the `prefers-reduced-motion` media query, which browsers respect automatically.

19.3 Thresholds + hysteresis (direction arrow) — FX only

Use pair-class thresholds:

Majors: ±0.02%

Volatile/EM: ±0.05%

Add hysteresis so arrows do not twitch.

19.4 Stale-data UX (no special mode)

If upstream updates stop (market closed, provider pause, or cached responses), the UI remains stable.

Movement/arrow state is derived from quote changes; if quotes do not change, nothing flips.

19.5 Trace UI usage

Trace is for debugging, not normal users.

Trace should never cause state changes.

19.6 SSOT change behaviour

Changing any ribbon's SSOT file updates what is displayed.

Server must treat it as a new cache identity.

19.7 Single source of truth for polling

Polling interval and shared state should live in one hook/store/context per feed.

If you add a widget and API call count increases linearly, that is a bug.

19.8 Optional movement fields (for "alive" UX, without extra upstream calls)

Promagen may expose optional movement fields computed from cached/baseline state:

baseline24h, change24h, changePct24h

winnerSide24h and a numeric confidence (0..1)

These must be:

derived from internal state/caches where possible

stable across cached vs live modes (or explicitly labelled)

stable when quotes are unchanged (no side flipping while prices are not updating)

They are optional; the system remains correct without them.

---

## 20. Gateway SSOT Fetch Architecture (Added Jan 9, 2026)

### 20.1 The Problem: Hardcoded Duplication

The gateway previously had a hardcoded `FX_PAIRS` array in `src/server.ts`. This duplicated what's in `frontend/src/data/fx/fx-pairs.json`:

```
❌ Two places to maintain = Drift guaranteed
frontend/src/data/fx/fx-pairs.json  ← File 1 (SSOT)
gateway/src/server.ts (hardcoded)   ← File 2 (duplicate)
```

### 20.2 The Solution: Runtime SSOT Fetch

The gateway now **fetches pairs from the frontend on startup**:

```
✅ TRUE SSOT
frontend/src/data/fx/fx-pairs.json   ← THE ONE AND ONLY SOURCE
              ↓
frontend/api/fx/config               ← Exposes SSOT as API
              ↓
gateway fetches on startup           ← Reads from frontend
              ↓
gateway serves FX quotes             ← Uses fetched pairs
```

### 20.3 Frontend SSOT Endpoint

**Location:** `frontend/src/app/api/fx/config/route.ts`

**Response format:**

```json
{
  "version": 1,
  "ssot": "frontend/src/data/fx/fx-pairs.json",
  "generatedAt": "2026-01-09T02:00:00.000Z",
  "pairs": [
    { "id": "eur-usd", "base": "EUR", "quote": "USD" },
    { "id": "gbp-usd", "base": "GBP", "quote": "USD" },
    { "id": "usd-jpy", "base": "USD", "quote": "JPY" }
  ]
}
```

**Behaviour:**

- Reads `fx-pairs.json` (unified catalog with all pair data, flags, demo values)
- Returns only `isDefaultFree=true` pairs for free tier
- Cached for 1 hour (config rarely changes)

### 20.4 Gateway Startup Sequence

```typescript
// Environment variable
const FX_CONFIG_URL = process.env['FX_CONFIG_URL'] ?? 'https://promagen.com/api/fx/config';

// Fallback pairs (only if frontend unreachable)
const FALLBACK_FX_PAIRS: FxPair[] = [...];

// Runtime state
let activeFxPairs: FxPair[] = [];
let ssotSource: 'frontend' | 'fallback' = 'fallback';

async function initFxPairs(): Promise<void> {
  const ssotPairs = await fetchSsotConfig();
  if (ssotPairs && ssotPairs.length > 0) {
    activeFxPairs = ssotPairs;
    ssotSource = 'frontend';
    log('info', 'Using SSOT pairs from frontend', { count: activeFxPairs.length });
  } else {
    activeFxPairs = FALLBACK_FX_PAIRS;
    ssotSource = 'fallback';
    log('warn', 'Using FALLBACK pairs - frontend SSOT unavailable');
  }
}

async function start(): Promise<void> {
  await initFxPairs();  // SSOT fetch FIRST
  // ... then start HTTP server
}
```

### 20.5 SSOT Metadata in Responses

**Health endpoint (`/health`):**

```json
{
  "status": "ok",
  "ssot": {
    "source": "frontend",
    "configUrl": "https://promagen.com/api/fx/config",
    "pairCount": 8,
    "pairs": ["eur-usd", "gbp-usd", ...]
  }
}
```

**FX endpoint (`/fx`) meta field:**

```json
{
  "meta": {
    "mode": "live",
    "ssotSource": "frontend",
    "budget": {
      "state": "ok",
      "dailyUsed": 128,
      "dailyLimit": 800
    }
  },
  "data": [...]
}
```

**Note:** Budget state is exposed in API responses for observability, but NOT as an emoji indicator in the UI (removed Jan 12, 2026).

### 20.6 Deployment Order (Critical)

**Always deploy frontend first:**

1. Deploy frontend → Vercel creates `/api/fx/config` endpoint
2. Deploy gateway → Fly.io fetches from the new endpoint

If you deploy gateway first, it will fall back to hardcoded pairs because the endpoint doesn't exist yet.

```powershell
# Step 1: Frontend
cd C:\Users\Proma\Projects\promagen\frontend
git push

# Step 2: Wait for Vercel deployment

# Step 3: Gateway
cd C:\Users\Proma\Projects\promagen\gateway
fly deploy
```

### 20.7 Verification

```powershell
# Check frontend SSOT endpoint
Invoke-RestMethod -Uri "https://promagen.com/api/fx/config"

# Check gateway loaded from SSOT
Invoke-RestMethod -Uri "https://promagen-api.fly.dev/health"
```

**Expected /health response:**

```json
{
  "ssot": {
    "source": "frontend" // ← SSOT working
  }
}
```

If `"source": "fallback"`, the gateway couldn't reach frontend.

### 20.8 Changing FX Pairs (The SSOT Way)

1. Edit **ONE file**: `frontend/src/data/fx/fx-pairs.json`
2. Deploy frontend: `git push`
3. Restart gateway: `fly apps restart promagen-api`

**One file. Both systems update. No drift.**

### 20.9 Pair Count Is Variable

From `ribbon-homepage.md`:

> The ribbon does not hard-code "5" or "8" anywhere.
> The number of FX chips shown is simply the number of entries with `isDefaultFree: true` in fx-pairs.json.

The gateway respects whatever the SSOT says — could be 5, 8, 12, or any number.

---

## 21. Four-Feed Architecture (Updated Jan 13, 2026)

### 21.1 Architecture Overview

All four data feeds (FX, Indices, Commodities, Crypto) now share **identical calming architecture**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FOUR-FEED CALMING ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Feed: FX           Feed: Indices       Feed: Commodities           │
│  ├── /api/fx        ├── /api/indices    ├── /api/commodities        │
│  ├── use-fx-quotes  ├── use-indices-quotes                          │
│  ├── fx-ribbon      ├── exchange-card   ├── commodities-ribbon      │
│  ├── TTL: 1800s     ├── TTL: 7200s (2h) ├── TTL: 1800s              │
│  ├── Slots: :00,:30 ├── Slots: :05,:35  ├── Slots: :10,:40          │
│  └── TwelveData     └── Marketstack     └── TwelveData              │
│                                                                     │
│  Feed: Crypto                                                       │
│  ├── /api/crypto                                                    │
│  ├── use-crypto-quotes.ts                                           │
│  ├── crypto-ribbon.container                                        │
│  ├── TTL: 1800s (30 min)                                            │
│  ├── Slots: :20, :50                                                │
│  └── TwelveData                                                     │
│                                                                     │
│  ALL FOUR USE:                                                      │
│  ├── Same 7 calming techniques (TTL, dedup, batch, etc.)            │
│  ├── Budget management (TwelveData 800/day, Marketstack 250/day)    │
│  ├── Same circuit breaker pattern                                   │
│  ├── Same graceful degradation                                      │
│  └── API timing stagger (prevents simultaneous upstream calls)      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 21.2 API Timing Stagger (Critical)

To prevent simultaneous upstream calls, each feed refreshes at **staggered intervals**:

```
Hour timeline (repeats every hour):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │COM │CRY │ FX │IDX │COM │CRY │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘

FX:          Minutes 0 and 30 (base schedule)      → TwelveData
Indices:     Minutes 5 and 35 (5-minute offset)    → Marketstack
Commodities: Minutes 10 and 40 (10-minute offset)  → TwelveData
Crypto:      Minutes 20 and 50 (20-minute offset)  → TwelveData
```

**Why stagger?**

- TwelveData has a **per-minute rate limit** (8 credits/minute)
- Marketstack has **separate budget** (250/day, doesn't affect TwelveData)
- Without stagger: 3 TwelveData feeds × 8 symbols = 24 credits at :00 and :30 → **rate limited**
- With stagger: 8 credits at each TwelveData slot → **safe**
- Indices at :05/:35 uses Marketstack (different provider, no conflict)

**Implementation (frontend hooks):**

```typescript
// use-commodities-quotes.ts
function getMsUntilNextCommoditiesSlot(): number {
  const now = new Date();
  const minute = now.getMinutes();
  const targets = [10, 40]; // Commodities refresh slots

  let best = targets[0] + 60 - minute;
  for (const t of targets) {
    const delta = t - minute;
    if (delta > 0 && delta < best) best = delta;
  }

  return Math.max(1000, best * 60_000 - now.getSeconds() * 1000);
}

// use-crypto-quotes.ts
function getMsUntilNextCryptoSlot(): number {
  const now = new Date();
  const minute = now.getMinutes();
  const targets = [20, 50]; // Crypto refresh slots
  // ... same calculation
}
```

### 21.3 Gateway Endpoints

| Feed        | Gateway Endpoint | Frontend Route     | Cache Key                |
| ----------- | ---------------- | ------------------ | ------------------------ |
| FX          | `/fx`            | `/api/fx`          | `fx:ribbon:all`          |
| Commodities | `/commodities`   | `/api/commodities` | `commodities:ribbon:all` |
| Crypto      | `/crypto`        | `/api/crypto`      | `crypto:ribbon:all`      |

All three endpoints use identical implementation patterns:

- `dedupedFetch{Feed}()` for request deduplication
- `{feed}Cache` Map for TTL caching
- Circuit breaker with 429/5xx handling
- Background refresh capability
- Graceful degradation to stale cache

### 21.4 SSOT Files

| Feed        | SSOT Location                                            |
| ----------- | -------------------------------------------------------- |
| FX          | `frontend/src/data/fx/fx-pairs.json`                     |
| Commodities | `frontend/src/data/commodities/commodities-catalog.json` |
| Crypto      | `frontend/src/data/crypto/crypto-catalog.json`           |

### 21.5 Budget Management (Shared)

All three feeds share a single TwelveData budget:

- **Daily limit:** 800 credits (shared across all feeds)
- **Per-minute limit:** 8 credits

With API timing stagger:

- FX: ~128 credits/day (16 refreshes × 8 credits)
- Commodities: ~128 credits/day
- Crypto: ~128 credits/day
- **Total: ~384 credits/day (48% of limit)**

### 21.6 Removed UI Features (Jan 12, 2026)

**Pause Button — REMOVED**

The global "Calm Mode" pause button has been removed from all ribbon containers.

What was removed:

- Pause button component from ribbon containers
- `useLiveStatus` hook references in ribbons
- "Calm mode" terminology from UI

What remains:

- `prefers-reduced-motion` CSS media query support (automatic)
- Visibility-aware polling backoff (automatic)
- Individual chip animations (subtle, non-intrusive)

**Budget Emoji Indicator — REMOVED**

The emoji budget indicator (🛫/🏖️/🧳) has been removed from all ribbon containers.

What was removed:

- `emoji-bank.json` budget_guard group
- Budget emoji rendering in ribbon containers
- Budget emoji passthrough in API responses

What remains:

- Server-side budget tracking (unchanged)
- Budget state in `/health` and `/trace` endpoints (unchanged)
- Automatic graceful degradation when budget is exhausted

---

## 22. Changelog

- **14 Jan 2026 (v2.6.0):** Provider-Based Gateway Architecture
  - Created Book 2 (`promagen-api-brain-v2-book2.md`) for §23–§26
  - §23: Provider-Based Gateway Architecture (folder structure)
  - §24: Clock-Aligned Scheduler (replaces 90% TTL drift)
  - §25: Budget Tracking (per provider)
  - §26: Architectural Guardrails (7 guardrails)
  - Gateway refactored: 4,002-line monolith → provider-based modules
  - Commodities now fallback only (no active provider)
  - Cross-reference: GATEWAY-REFACTOR.md for implementation blueprint
- **13 Jan 2026 (v2.5.0):** Four-Feed Architecture (Indices)
  - Updated §21 from Three-Feed to Four-Feed Architecture
  - Added Indices feed (Marketstack provider, separate from TwelveData)
  - Added :05/:35 stagger slot for indices
  - Added 2-hour TTL for indices (vs 30-min for ribbons)
  - Gateway `/indices` endpoint with full calming architecture
  - Frontend `useIndicesQuotes` hook polling at :05/:35
  - Exchange Card `IndexRow` component (always visible)
  - Multi-provider budget tracking (TwelveData 800, Marketstack 250)
  - Cross-reference: MARKETSTACK-ACTION-PLAN.md
- **12 Jan 2026 (v2.4.0):** Three-Feed Architecture
  - Added §21 Three-Feed Architecture documentation
  - Added Commodities role (commodities.ribbon, commodities.trace) to API Surface Index
  - Added Crypto role (crypto.ribbon, crypto.trace) to API Surface Index
  - Updated Roles Table with refresh slots for API timing stagger
  - Documented API timing stagger: FX :00/:30, Commodities :10/:40, Crypto :20/:50
  - REMOVED: Budget emoji indicator from UI (§9.1.2.1 updated)
  - REMOVED: Pause button from all ribbons (§19.2 updated)
  - Updated provider catalogue to include all three ribbon roles
  - Added cross-references to api-calming-efficiency.md and ribbon-homepage.md
- **10 Jan 2026 (v2.3.0):** FX SSOT Consolidated — Updated all references from separate `fx.pairs.json` + `pairs.json` files to unified `fx-pairs.json`. Single file now contains all FX pair data: IDs, currencies, country codes, labels, precision, demo prices, tier flags, and longitude. Updated §20.3 behaviour description.
- **9 Jan 2026 (v2.2.0):** Added §20 Gateway SSOT Fetch Architecture. Gateway now fetches FX pairs from frontend `/api/fx/config` on startup instead of hardcoding. True SSOT: one file, both systems update. Added SSOT metadata to /health and /fx responses. Fixed TypeScript import errors (NodeNext requires .js extensions). Files updated: `gateway/src/server.ts`, `frontend/src/app/api/fx/config/route.ts`, `gateway/lib/*.ts`.
- **8 Jan 2026 (v2.1.0):** Gateway TypeScript & security fixes. Fixed 12 TypeScript compilation errors. Added Zod dependency for runtime validation. All gateway files now at 10/10 security score with proper type guards, no unsafe casts, and graceful degradation. Files updated: `gateway/lib/schemas.ts`, `gateway/index.ts`, `gateway/adapters/twelvedata.fx.ts`.
- **6 Jan 2026:** Initial v2 release with full SSOT, cost-control, A/B alternation, and trace contract documentation.
