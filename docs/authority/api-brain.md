Promagen API Brain v2 — Registry + Policies (SSOT + Cost-Control)
Sections §0–§26 (formerly Book 1 + Book 2, now unified)  
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

**v2.4.0 update (Jan 12, 2026):** Extended architecture to multiple feeds with identical calming, API timing stagger to prevent rate limits, and removed UI budget emoji indicator. **v2.7.0 update (Feb 7, 2026):** Full audit — crypto removed, commodities LIVE on Marketstack v2, weather added, indices 4×/hour, Marketstack 3,333/day, 17 calming techniques.

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

> **Note (Feb 7, 2026):** Crypto catalog removed — crypto feed was removed entirely from the codebase.

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
declares routing policy per role (FX, commodities, indices, weather, etc.), including fallback chains and caching rules

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

- roles supported (e.g. fx.ribbon, commodities.ribbon, indices.ribbon, weather)
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

- role id (e.g. fx.ribbon, commodities.ribbon, indices.ribbon, weather)
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
indices.ribbon
indices.trace
commodities.ribbon
commodities.trace
weather

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
| /api/commodities                   | commodities.ribbon  | Yes (Refresh Gate)    | 2h (server TTL)          | Yes (via /trace)              | Commodities data (Marketstack v2)  |
| /api/commodities/trace             | commodities.trace   | Yes (observer-only)   | no-store                 | Yes                           | Commodities trace (read-only)      |
| /api/consent                       | consent             | No                    | no-store                 | No                            | Consent preferences                |
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
| /api/weather                       | weather             | Yes (Refresh Gate)    | 5m (server TTL)          | Yes (via /trace)              | Weather data (OpenWeatherMap)      |
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

| Role id            | Primary route(s)       | Provider chain source                                                  | TTL / cache authority | Bulk rules      | Refresh slot        | Forbidden means                                | Trace                             |
| ------------------ | ---------------------- | ---------------------------------------------------------------------- | --------------------- | --------------- | ------------------- | ---------------------------------------------- | --------------------------------- |
| fx.ribbon          | /api/fx                | roles.policies.json → providers.registry.json (execution via adapters) | Server TTL 30 min     | Bulk-only (N→1) | :00, :30            | budget block; missing key; ride-cache cooldown | /api/fx/trace (observer-only)     |
| fx.trace           | /api/fx/trace          | none (observer-only)                                                   | no-store preferred    | n/a             | n/a                 | never calls upstream; never mutates cache      | itself                            |
| indices.ribbon     | /api/indices           | roles.policies.json → providers.registry.json (execution via adapters) | Server TTL 2 hours    | Bulk-only (N→1) | :05, :20, :35, :50  | budget block; missing key; ride-cache cooldown | /api/indices (via /trace)         |
| indices.trace      | /api/indices (trace)   | none (observer-only)                                                   | no-store preferred    | n/a             | n/a                 | never calls upstream; never mutates cache      | itself                            |
| commodities.ribbon | /api/commodities       | marketstack/ module (rolling scheduler)                                | Server TTL 2 hours    | 1-per-call      | rolling every 5 min | budget block; missing key; ride-cache cooldown | /api/commodities/trace (observer) |
| commodities.trace  | /api/commodities/trace | none (observer-only)                                                   | no-store preferred    | n/a             | n/a                 | never calls upstream; never mutates cache      | itself                            |
| weather            | /api/weather           | openweathermap/ module                                                 | Server TTL 5 min      | Batch (24/call) | :10, :40            | budget block; missing key                      | /api/weather (via /trace)         |

**Refresh slot** (updated Feb 7, 2026): FX and Weather use clock-aligned slots. Indices uses 4×/hour clock-aligned. Commodities uses a rolling 5-min scheduler (not clock-aligned — 78 items, 1-per-call API). See §21.2.

Runtime knobs (environment variables, server-only)

TwelveData (FX only):

- TWELVEDATA_API_KEY
- TWELVEDATA_BUDGET_DAILY (800/day)
- TWELVEDATA_BUDGET_MINUTE (8/min)
- FX_RIBBON_TTL_SECONDS (default 1800)

Marketstack (Indices + Commodities, shared 3,333/day Professional):

- MARKETSTACK_API_KEY
- MARKETSTACK_BUDGET_DAILY (3333/day shared pool)
- MARKETSTACK_BUDGET_MINUTE (60/min)
- INDICES_RIBBON_TTL_SECONDS (default 7200)
- COMMODITIES_REFRESH_INTERVAL_MS (default 300000 = 5 min)
- COMMODITIES_BUDGET_DAILY (1000/day cap, subset of shared pool)

OpenWeatherMap (Weather):

- OPENWEATHERMAP_API_KEY
- OPENWEATHERMAP_BUDGET_DAILY (1000/day)

Per-feed TTL overrides:

- FX_RIBBON_TTL_SECONDS (default 1800)
- INDICES_RIBBON_TTL_SECONDS (default 7200)

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
- roles: fx.ribbon (FX only — crypto removed, commodities moved to Marketstack)
- bulk: yes (Promagen uses one bulk request per ribbon feed)
- symbol format expected by Promagen SSOT + UI:
  - FX: "USD/JPY" style
- known failure modes to treat as normal:
  - HTTP 429 / "rate limit" → Gate applies ride-cache cooldown; trace explains budget state and last decision
  - 200 OK but missing some symbols → treat as partial data; return "—" for those chips; list missing symbols in trace
  - provider latency/timeouts → treat as upstream failure; attempt fallback chain only if policy allows

Provider: marketstack

- providerId: marketstack
- env vars: MARKETSTACK_API_KEY (server-only)
- roles: indices.ribbon, commodities.ribbon
- budget: 3,333/day (Professional tier, 100K/month), 60/min
- bulk: yes for indices (batch benchmark symbols), no for commodities (1-per-call API)
- commodities: rolling 5-min scheduler, all 78 fully shuffled (Fisher-Yates) each cycle, ~288 calls/day
- indices: clock-aligned :05/:20/:35/:50, ~96 calls/day
- known failure modes: 429, partial data, weekend/holiday gaps

Provider: openweathermap

- providerId: openweathermap
- env vars: OPENWEATHERMAP_API_KEY (server-only)
- roles: weather
- budget: 1,000/day
- bulk: batch of 24 cities per call (2 batches = 48 cities)
- schedule: clock-aligned :10/:40

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

/api/fx/trace, /api/commodities/trace must never trigger upstream refresh.

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

- role (fx.ribbon, commodities.ribbon, indices.ribbon, or weather)
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

- role id (fx.ribbon, commodities.ribbon, indices.ribbon, weather)
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

## 21. Four-Feed Architecture (Updated Feb 7, 2026)

### 21.1 Architecture Overview

All four data feeds (FX, Indices, Commodities, Weather) now share **identical calming architecture** across **3 providers**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FOUR-FEED CALMING ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Feed: FX           Feed: Indices       Feed: Commodities           │
│  ├── /api/fx        ├── /api/indices    ├── /api/commodities        │
│  ├── use-fx-quotes  ├── use-indices-quotes                          │
│  ├── fx-ribbon      ├── exchange-card   ├── commodity-windows       │
│  ├── TTL: 1800s     ├── TTL: 7200s (2h) ├── TTL: 7200s per-item   │
│  ├── Slots: :00,:30 ├── :05,:20,:35,:50 ├── Rolling 5-min          │
│  └── TwelveData     └── Marketstack     └── Marketstack v2         │
│                                                                     │
│  Feed: Weather                                                      │
│  ├── /api/weather                                                   │
│  ├── City batching (48 cities, 2 batches)                           │
│  ├── TTL: 5 min                                                     │
│  ├── Slots: :10, :40                                                │
│  └── OpenWeatherMap                                                 │
│                                                                     │
│  ALL FOUR USE:                                                      │
│  ├── Same 17 calming techniques (TTL, dedup, batch, etc.)           │
│  ├── Budget management per provider:                                │
│  │   TwelveData 800/day (FX only)                                   │
│  │   Marketstack 3,333/day (Indices + Commodities)                  │
│  │   OpenWeatherMap 1,000/day (Weather)                             │
│  ├── Same circuit breaker pattern                                   │
│  ├── Same graceful degradation                                      │
│  └── API timing stagger (prevents simultaneous upstream calls)      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

> **Note:** Crypto feed was removed entirely from the codebase. TwelveData now serves FX only.

### 21.2 API Timing Stagger (Critical)

To prevent simultaneous upstream calls, each feed refreshes at **staggered intervals**:

```
Hour timeline (every hour):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │WTH │IDX │ FX │IDX │WTH │IDX │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑   ↑    ↑    ↑    ↑    ↑    ↑
  TD   MS  OWM  MS   TD   MS  OWM  MS

+ Commodities: rolling every 5 min (Marketstack v2, not clock-aligned)

FX:          Minutes 0 and 30 (base schedule)             → TwelveData
Indices:     Minutes 5, 20, 35, 50 (15-minute intervals)  → Marketstack
Weather:     Minutes 10 and 40                             → OpenWeatherMap
Commodities: Rolling every 5 min (1 commodity per call)    → Marketstack v2
```

**Why stagger?**

- TwelveData has a **per-minute rate limit** (8 credits/minute) — now serves FX only
- Marketstack has **separate budget** (3,333/day Professional, shared between Indices + Commodities)
- OpenWeatherMap has **separate budget** (1,000/day)
- Without stagger: multiple providers hit at same minute → needless contention
- Commodities uses **rolling scheduler** because the API supports only 1 commodity per call (78 items would overwhelm a single clock slot)

**Implementation (gateway schedulers):**

```typescript
// marketstack/scheduler.ts — Indices (clock-aligned)
// Refreshes at :05, :20, :35, :50 each hour
const INDICES_SLOTS = [5, 20, 35, 50];

// marketstack/commodities-scheduler.ts — Commodities (rolling)
// Processes 1 commodity every 5 minutes, all 78 fully shuffled (Fisher-Yates) each cycle
// 78 commodities × 5 min = 6.5 hours per full cycle (~3.7 cycles/day)

// openweathermap/handler.ts — Weather (clock-aligned)
// Refreshes at :10, :40 each hour (48 cities in 2 batches of 24)
```

### 21.3 Gateway Endpoints

| Feed        | Gateway Endpoint | Frontend Route     | Cache Key                |
| ----------- | ---------------- | ------------------ | ------------------------ |
| FX          | `/fx`            | `/api/fx`          | `fx:ribbon:all`          |
| Indices     | `/indices`       | `/api/indices`     | `indices:ribbon:all`     |
| Commodities | `/commodities`   | `/api/commodities` | `commodities:ribbon:all` |
| Weather     | `/weather`       | `/api/weather`     | `weather:all`            |

All four endpoints use identical implementation patterns:

- `dedupedFetch{Feed}()` for request deduplication
- `{feed}Cache` Map for TTL caching
- Circuit breaker with 429/5xx handling
- Background refresh capability
- Graceful degradation to stale cache

### 21.4 SSOT Files

| Feed        | SSOT Location                                            |
| ----------- | -------------------------------------------------------- |
| FX          | `frontend/src/data/fx/fx-pairs.json`                     |
| Indices     | `frontend/src/data/exchanges/exchanges.catalog.json`     |
| Commodities | `frontend/src/data/commodities/commodities-catalog.json` |
| Weather     | Derived from exchanges catalog (city coordinates)        |

### 21.5 Budget Management (Per Provider)

Feeds use **3 separate providers** with independent budgets:

**TwelveData (FX only):**

- Daily limit: 800 credits
- Per-minute limit: 8 credits
- FX: ~48-96 credits/day (2 refreshes/hr × 8 credits = ~16/hr × 6-12 active hours)
- **Usage: 6-12% of daily limit**

**Marketstack (Indices + Commodities, shared pool):**

- Daily limit: 3,333 credits (Professional tier, $49/month)
- Per-minute limit: 60
- Indices: ~96 calls/day (4×/hour, batch of benchmark symbols)
- Commodities: ~288 calls/day (rolling 5-min, 1 commodity per call, capped at 1,000/day)
- **Combined: ~384 calls/day (11.5% of shared pool)**

**OpenWeatherMap (Weather):**

- Daily limit: 1,000 credits
- Weather: ~576 calls/day (2×/hour, 48 cities in 2 batches of 24, ~12 calls/refresh × 48 refreshes)
- **Usage: ~57.6% of daily limit**

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

- **7 Feb 2026 (v2.7.0):** Full audit — doc corrected to match reality
  - REMOVED: All crypto references (feed, roles, routes, SSOT, provider catalogue, timing stagger)
  - UPDATED: Commodities → ✅ LIVE on Marketstack v2 (rolling 5-min scheduler, not TwelveData)
  - ADDED: Weather role (OpenWeatherMap, :10/:40, 1,000/day)
  - ADDED: Indices role to roles table (indices.ribbon, indices.trace)
  - FIXED: Indices schedule → :05/:20/:35/:50 (4×/hr, was :05/:35)
  - FIXED: Marketstack budget → 3,333/day (Professional tier, was 250)
  - FIXED: TwelveData → FX only (was FX + Commodities + Crypto)
  - UPDATED: Calming techniques 7 → 17
  - UPDATED: §21 Four-Feed diagram rebuilt (3 providers, no crypto)
  - UPDATED: §21.2 timing stagger (4 feeds, 3 providers)
  - UPDATED: §21.3 gateway endpoints (added indices + weather, removed crypto)
  - UPDATED: §21.5 budget management (per-provider breakdown)
  - UPDATED: Runtime knobs (per-provider env vars)
  - UPDATED: Provider catalogue (TwelveData FX only, added Marketstack + OWM)
  - UPDATED: API Surface Index (removed crypto rows, weather now Brain-governed)
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

---

# — Sections §23–§26 (formerly Book 2) —

---

## 23. Provider-Based Gateway Architecture (Added Jan 14, 2026)

### 23.1 Background

The gateway `server.ts` grew to **4,002 lines** — a monolithic file with duplicated patterns across all four feeds. This made debugging difficult, especially for budget-related issues where TwelveData logic was scattered across multiple places.

**Problems with monolithic structure:**

- Fix a cache bug in FX → forget to fix in other feeds
- TwelveData budget logic scattered across multiple places
- Scheduler logic for same provider in multiple files
- Adding new feed = copy 800 lines

### 23.2 New Architecture: Organize by Provider

The gateway was refactored from **feed-based** to **provider-based** organization:

```
gateway/src/
├── server.ts                    # ~720 lines: routes + startup
│
├── lib/                         # Shared infrastructure (provider-agnostic)
│   ├── types.ts                 # All shared type definitions
│   ├── cache.ts                 # GenericCache<T> class
│   ├── circuit.ts               # CircuitBreaker class
│   ├── dedup.ts                 # RequestDeduplicator<T> class
│   ├── feed-handler.ts          # createFeedHandler() factory
│   └── logging.ts               # Structured logging utilities
│
├── twelvedata/                  # ← Everything TwelveData in ONE place
│   ├── README.md                # Provider documentation
│   ├── index.ts                 # Exports fxHandler
│   ├── adapter.ts               # TwelveData API fetch logic
│   ├── budget.ts                # 800/day budget (FX only)
│   ├── scheduler.ts             # Clock-aligned slots (:00/:30 FX)
│   └── fx.ts                    # FX feed config ✅ LIVE
│
├── marketstack/                 # ← Everything Marketstack in ONE place
│   ├── README.md                # Provider documentation
│   ├── index.ts                 # Exports indicesHandler, commoditiesHandler
│   ├── adapter.ts               # Marketstack API fetch logic + benchmark mapping
│   ├── budget.ts                # Shared 3,333/day budget (Professional tier)
│   ├── scheduler.ts             # Clock-aligned slots (:05/:20/:35/:50 indices)
│   ├── indices.ts               # Indices feed config ✅ LIVE
│   ├── commodities.ts           # Commodities feed config ✅ LIVE
│   ├── commodities-scheduler.ts # Rolling 5-min scheduler (Fisher-Yates randomised)
│   └── commodities-budget.ts    # Separate 1,000/day cap for commodities
│
└── openweathermap/              # ← Everything OpenWeatherMap in ONE place
    ├── index.ts                 # Exports weather handler + helpers
    └── handler.ts               # Weather feed with city batching ✅ LIVE
```

### 23.3 Key Changes

| Aspect                  | Before (Monolithic) | After (Provider-Based) |
| ----------------------- | ------------------- | ---------------------- |
| **server.ts**           | 4,002 lines         | ~250 lines             |
| **Debug TwelveData**    | Search entire file  | Look in `twelvedata/`  |
| **Budget location**     | Scattered           | One file per provider  |
| **Scheduler location**  | Scattered           | One file per provider  |
| **Add TwelveData feed** | Copy 800 lines      | Add one config file    |
| **Test in isolation**   | Impossible          | Import provider module |

### 23.4 Updated Architecture Diagram

**Replaces §21.1 in Book 1:**

```
┌─────────────────────────────────────────────────────────────────────┐
│              FOUR-FEED ARCHITECTURE (PROVIDER-BASED)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GATEWAY STRUCTURE:                                                 │
│  ┌──────────────────┬─────────────────────────┬──────────────────┐  │
│  │  twelvedata/     │  marketstack/           │  openweathermap/ │  │
│  │  ├── budget.ts   │  ├── budget.ts          │  ├── handler.ts  │  │
│  │  ├── scheduler   │  ├── scheduler          │  └── (1,000/day) │  │
│  │  └── fx.ts       │  ├── indices.ts         │      ✅ LIVE     │  │
│  │  (800/day)       │  ├── commodities.ts     │                  │  │
│  │  FX only         │  ├── commodities-sched  │                  │  │
│  │                  │  └── (3,333/day shared)  │                  │  │
│  └──────────────────┴─────────────────────────┴──────────────────┘  │
│                                                                     │
│  Feed: FX           Feed: Indices       Feed: Commodities           │
│  ├── /api/fx        ├── /api/indices    ├── /api/commodities        │
│  ├── use-fx-quotes  ├── use-indices     ├── commodity-windows       │
│  ├── fx-ribbon      ├── exchange-card   ├── 7 content windows       │
│  ├── TTL: 1800s     ├── TTL: 7200s (2h) ├── TTL: 7200s per-item   │
│  ├── Slots: :00,:30 ├── :05,:20,:35,:50 ├── Rolling 5-min          │
│  └── TwelveData     └── Marketstack     └── Marketstack v2         │
│                                                                     │
│  Feed: Weather                                                      │
│  ├── /api/weather                                                   │
│  ├── City batching (48 cities, 2 batches of 24)                     │
│  ├── TTL: 5 min                                                     │
│  ├── Slots: :10, :40                                                │
│  └── OpenWeatherMap                                                 │
│                                                                     │
│  ALL FOUR USE:                                                      │
│  ├── Same 17 calming techniques (TTL, dedup, batch, etc.)           │
│  ├── Budget management per provider:                                │
│  │   TwelveData 800/day, Marketstack 3,333/day, OWM 1,000/day      │
│  ├── Clock-aligned scheduler (FX, Indices, Weather)                 │
│  ├── Rolling scheduler (Commodities — 1-per-call API)               │
│  ├── Same circuit breaker pattern                                   │
│  └── Same graceful degradation                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

> **Note (Feb 7, 2026):** Crypto feed removed entirely. TwelveData now serves FX only. Commodities moved from `fallback/` to `marketstack/` (now LIVE on Marketstack v2).

### 23.5 Updated API Timing Stagger

**Updates §21.2 in Book 1 — now 4 feeds across 3 providers:**

```
Hour timeline (every hour):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ FX │IDX │WTH │IDX │ FX │IDX │WTH │IDX │ FX │
└────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑   ↑    ↑    ↑    ↑    ↑    ↑
  TD   MS  OWM  MS   TD   MS  OWM  MS

+ Commodities: rolling every 5 min (Marketstack v2, not clock-aligned)

TD  = TwelveData (800/day, FX only)
MS  = Marketstack (3,333/day shared, Indices + Commodities)
OWM = OpenWeatherMap (1,000/day, Weather)

FX:          Minutes 0 and 30 (base schedule)             → TwelveData
Indices:     Minutes 5, 20, 35, 50 (15-minute intervals)  → Marketstack
Weather:     Minutes 10 and 40                             → OpenWeatherMap
Commodities: Rolling every 5 min (1 commodity per call)    → Marketstack v2
```

**Why stagger?**

- TwelveData has a **per-minute rate limit** (8 credits/minute) — now serves FX only
- Marketstack has **separate budget** (3,333/day Professional, shared between Indices + Commodities)
- OpenWeatherMap has **separate budget** (1,000/day)
- Commodities uses **rolling scheduler** because the API supports only 1 commodity per call
- Without stagger: multiple providers hit at same minute → needless contention
- With stagger: each provider fires in its own slot → **safe**

---

## 24. Clock-Aligned Scheduler

### 24.1 The Problem: 90% TTL Drift

The old approach used 90% of TTL as the refresh interval:

```typescript
// ❌ BAD: Creates drift over time
setInterval(() => refresh(), config.ttlSeconds * 1000 * 0.9);

// Example with 30-minute TTL (1800s):
// 1800 * 0.9 = 1620 seconds = 27 minutes

// FX starts at :00 → :27 → :54 → :21 → :48 → :15...
// Indices start at :05 → :32 → :59 → :26 → :53...
// Eventually they COLLIDE and both fire in the same minute!
```

### 24.2 The Solution: Clock-Aligned Slots

The new approach uses fixed clock times:

```typescript
// ✅ GOOD: Fixed slots, never drift
// twelvedata/scheduler.ts

export type TwelveDataFeed = 'fx';

const FEED_SLOTS: Record<TwelveDataFeed, number[]> = {
  fx: [0, 30], // Minutes 0 and 30
};

// marketstack/scheduler.ts — Indices (separate provider)
const INDICES_SLOTS = [5, 20, 35, 50]; // 4× per hour

// openweathermap/handler.ts — Weather (separate provider)
const WEATHER_SLOTS = [10, 40]; // 2× per hour

// marketstack/commodities-scheduler.ts — Rolling (not clock-aligned)
// Every 5 min, 1 commodity at a time, Fisher-Yates randomised queue

export function getMsUntilNextSlot(feed: TwelveDataFeed): number {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const slots = FEED_SLOTS[feed];

  // Find next slot
  let nextSlot = slots.find((s) => s > currentMinute);
  if (!nextSlot) {
    nextSlot = slots[0] + 60; // Wrap to next hour
  }

  const minutesUntil = nextSlot - currentMinute;
  const msUntil = (minutesUntil * 60 - currentSecond) * 1000;

  return Math.max(1000, msUntil); // Minimum 1 second
}

// Usage in background refresh:
function startBackgroundRefresh(feed: TwelveDataFeed): void {
  setTimeout(() => {
    refresh();
    setInterval(() => refresh(), 30 * 60 * 1000); // Exactly 30 min
  }, getMsUntilNextSlot(feed)); // Wait for next slot
}

// FX ALWAYS at :00, :30
// Indices ALWAYS at :05, :20, :35, :50
// Weather ALWAYS at :10, :40
// Commodities rolling every 5 min
// NEVER collide!
```

### 24.3 Scheduler Interface

All schedulers implement a shared interface (enforced by TypeScript):

```typescript
// lib/types.ts
export interface FeedScheduler {
  getMsUntilNextSlot(): number;
  getNextSlotTime(): Date;
  isSlotActive(): boolean;
}
```

This ensures TwelveData and Marketstack schedulers stay consistent.

---

## 25. Budget Tracking (Per Provider)

### 25.1 One Instance Per Provider

Each provider has exactly ONE budget instance:

```typescript
// twelvedata/budget.ts — ONE instance for ALL TwelveData feeds
import { BudgetManager } from '../lib/budget.js';

export const twelveDataBudget = new BudgetManager({
  id: 'twelvedata',
  dailyLimit: parseInt(process.env.TWELVEDATA_BUDGET_DAILY || '800'),
  minuteLimit: parseInt(process.env.TWELVEDATA_BUDGET_MINUTE || '8'),
  warnThreshold: 0.7,
});

// Export for diagnostics
export function getTwelveDataBudgetState(): BudgetState {
  return twelveDataBudget.getState();
}
```

```typescript
// marketstack/budget.ts — SEPARATE instance for Marketstack
export const marketstackBudget = new BudgetManager({
  id: 'marketstack',
  dailyLimit: parseInt(process.env.MARKETSTACK_BUDGET_DAILY || '3333'),
  minuteLimit: parseInt(process.env.MARKETSTACK_BUDGET_MINUTE || '60'),
  warnThreshold: 0.7,
});
```

### 25.2 Shared vs Separate Budgets

| Provider       | Feeds                 | Budget                              | File                                |
| -------------- | --------------------- | ----------------------------------- | ----------------------------------- |
| TwelveData     | FX                    | 800/day (FX only)                   | `twelvedata/budget.ts`              |
| Marketstack    | Indices + Commodities | 3,333/day **SHARED** (Professional) | `marketstack/budget.ts`             |
| Marketstack    | Commodities (cap)     | 1,000/day **SUBSET**                | `marketstack/commodities-budget.ts` |
| OpenWeatherMap | Weather               | 1,000/day **SEPARATE**              | `openweathermap/`                   |

**Key insight:** Indices and Commodities both share the Marketstack budget pool (3,333/day), but Commodities has a separate 1,000/day cap to prevent it from crowding out Indices. Combined Marketstack usage: ~384 calls/day (11.5% of pool).

### 25.3 Commodities Status

Commodities is now **LIVE on Marketstack v2** (moved from fallback, Feb 2026):

```typescript
// marketstack/commodities-scheduler.ts
// Rolling scheduler: 1 commodity every 5 minutes
// 78 commodities × 5 min = 6.5 hours per full cycle (~3.7 cycles/day)
// Queue: ALL 78 fully shuffled via Fisher-Yates each cycle (no tiers, no priority)
// ~288 calls/day, capped at 1,000/day
```

The `/commodities` endpoint returns `source: 'marketstack'` with real prices.

---

## 26. Architectural Guardrails

### 26.1 Overview

The provider-based structure solves many problems but introduces new risks. This section documents each risk and the guardrail that prevents it.

| #   | Risk                       | Severity | Guardrail               |
| --- | -------------------------- | -------- | ----------------------- |
| G1  | Cross-provider duplication | Medium   | Shared code in `lib/`   |
| G2  | Hard to find all feeds     | Low      | `server.ts` as index    |
| G3  | Import path complexity     | Low      | Flat import convention  |
| G4  | Scheduler/budget drift     | Medium   | Shared interfaces       |
| G5  | Onboarding curve           | Low      | README per folder       |
| G6  | Circular dependencies      | Medium   | One-way dependency flow |
| G7  | Over-abstraction           | Low      | File count limits       |

### 26.2 G1: Shared Code in `lib/`

**Risk:** Cross-provider logic duplication — same cache/circuit/budget logic copied to each provider folder.

**Rule:** If logic is used by 2+ providers, it MUST be in `lib/`.

```
✅ GOOD: Shared logic in lib/
lib/cache.ts         ← GenericCache used by ALL providers
lib/circuit.ts       ← CircuitBreaker used by ALL providers
lib/feed-handler.ts  ← createFeedHandler() factory

❌ BAD: Duplicated in each provider
twelvedata/cache.ts  ← Don't do this
marketstack/cache.ts ← Don't do this
```

### 26.3 G2: `server.ts` as Feed Index

**Risk:** Hard to find all feeds — they're scattered across 3 different folders.

**Rule:** `server.ts` imports from provider `index.ts` files, making it the one place to see all feeds.

```typescript
// server.ts — THE place to see all feeds at a glance
import { fxHandler } from './twelvedata/index.js';
import { indicesHandler, commoditiesHandler } from './marketstack/index.js';
import { weatherHandler } from './openweathermap/index.js';
```

### 26.4 G3: Flat Import Convention

**Risk:** Import path complexity — easy to get `../lib/` vs `../../lib/` wrong.

**Rules:**

- Provider → lib = always `../lib/`
- Provider → same provider = always `./`
- NEVER import across providers

```typescript
// twelvedata/fx.ts
import { createFeedHandler } from '../lib/feed-handler.js'; // ✅ ../lib/
import { twelveDataBudget } from './budget.js'; // ✅ ./

// ❌ NEVER do this:
import { marketstackBudget } from '../marketstack/budget.js'; // Cross-provider!
```

### 26.5 G4: Shared Interfaces

**Risk:** Scheduler/budget drift — TwelveData scheduler gets updated, Marketstack scheduler doesn't.

**Rule:** All schedulers and budgets implement shared interfaces from `lib/types.ts`.

```typescript
// lib/types.ts
export interface FeedScheduler {
  getMsUntilNextSlot(): number;
  getNextSlotTime(): Date;
  isSlotActive(): boolean;
}

export interface BudgetManagerInterface {
  canSpend(credits: number): boolean;
  spend(credits: number): void;
  getState(): BudgetState;
  reset(): void;
}
```

**Enforcement:** TypeScript compiler. If interface changes, ALL implementations must update.

### 26.6 G5: README Per Provider Folder

**Risk:** Onboarding curve — new dev doesn't know where to look.

**Rule:** Every provider folder has a `README.md` explaining what it does.

```markdown
# TwelveData Provider

**Handles:** FX feed  
**Budget:** 800 credits/day (FX only)  
**Scheduler:** Clock-aligned :00/:30 (FX)

## Files

| File           | Purpose                |
| -------------- | ---------------------- |
| `index.ts`     | Exports fxHandler      |
| `budget.ts`    | Single budget instance |
| `scheduler.ts` | Clock-aligned timing   |
| `fx.ts`        | FX feed configuration  |
```

### 26.7 G6: One-Way Dependency Flow

**Risk:** Circular dependencies — provider imports lib, lib imports provider.

**Rule:** Dependencies flow DOWN only.

```
┌─────────────┐
│  server.ts  │  ← Imports from provider folders
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│  Provider folders (twelvedata, marketstack, openweathermap) │  ← Import from lib/
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│    lib/     │  ← NEVER imports from provider folders
└─────────────┘
```

**Enforcement:** ESLint `import/no-cycle` rule.

### 26.8 G7: File Count Limits

**Risk:** Over-abstraction — too many tiny files.

**Rule:** Each folder has a maximum file count.

| Folder            | Max Files | Rationale                                                                            |
| ----------------- | --------- | ------------------------------------------------------------------------------------ |
| `lib/`            | 10        | Core infrastructure only                                                             |
| `twelvedata/`     | 8         | README, index, adapter, budget, scheduler, + feeds                                   |
| `marketstack/`    | 12        | README, index, adapter, budget, scheduler, indices, commodities + scheduler + budget |
| `openweathermap/` | 5         | index, handler, + future expansion                                                   |

### 26.9 Guardrail Checklist (For Code Reviews)

```
- [ ] G1: Is shared logic in `lib/`, not duplicated in provider folders?
- [ ] G2: Does new feed appear in `server.ts` imports?
- [ ] G3: Are imports flat (`../lib/` or `./`), no cross-provider imports?
- [ ] G4: Do schedulers/budgets implement shared interfaces?
- [ ] G5: Is README.md updated if provider folder changes?
- [ ] G6: No circular dependencies?
- [ ] G7: File count within limits?
```

---

## Cross-References

| Document                                | Relevance                          |
| --------------------------------------- | ---------------------------------- |
| **Book 1** (`promagen-api-brain-v2.md`) | §0–§22: Core policies, roles, SSOT |
| `GATEWAY-REFACTOR.md`                   | Full implementation blueprint      |
| `api-calming-efficiency.md`             | Calming techniques, metrics        |
| `fly-v2.md`                             | §12: Provider-based deployment     |
| `ARCHITECTURE.md`                       | Gateway architecture overview      |

---

## Changelog

| Date       | Version | Change                                                                                 |
| ---------- | ------- | -------------------------------------------------------------------------------------- |
| 2026-02-07 | v2.7.0  | **Full audit — corrected to match reality**                                            |
|            |         | §23.2: Removed crypto.ts + fallback/; added marketstack/commodities\*, openweathermap/ |
|            |         | §23.4: Architecture diagram rebuilt (3 providers, no crypto, weather added)            |
|            |         | §23.5: Timing stagger rebuilt (4 feeds, 3 providers)                                   |
|            |         | §24: Scheduler code updated (TwelveData FX only)                                       |
|            |         | §25: Budget tracking — Marketstack 250→3,333, commodities LIVE, OWM added              |
|            |         | §26: Guardrails updated (imports, README, file limits, dependency flow)                |
| 2026-01-14 | v2.6.0  | **Book 2 created**                                                                     |
|            |         | Added §23 Provider-Based Gateway Architecture                                          |
|            |         | Added §24 Clock-Aligned Scheduler                                                      |
|            |         | Added §25 Budget Tracking (Per Provider)                                               |
|            |         | Added §26 Architectural Guardrails (7 guardrails)                                      |
|            |         | Updated architecture diagram for provider folders                                      |
|            |         | Updated timing stagger — Commodities now fallback only                                 |
|            |         | Gateway refactored: 4,002-line monolith → provider-based modules                       |

---

## Summary

**Book 2 documents the gateway architecture (originally Jan 14, updated Feb 7 2026):**

1. **Provider-based folders** — `twelvedata/`, `marketstack/`, `openweathermap/`
2. **Clock-aligned + rolling schedulers** — Fixed slots for FX/Indices/Weather, rolling for Commodities
3. **One budget per provider** — TwelveData 800/day (FX), Marketstack 3,333/day (Indices + Commodities), OWM 1,000/day (Weather)
4. **7 guardrails** — Prevent drift, duplication, and circular dependencies

**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth.

---

