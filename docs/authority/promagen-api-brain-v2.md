Promagen API Brain v2 — Registry + Policies (SSOT + Cost-Control)

Purpose: A single, explicit, testable set of rules for how Promagen selects providers, controls spend, caches responses, slices workload, and exposes trace data — without letting UI polling or widget count accidentally drive upstream cost.
Monetisation scope note (keep docs separated)
This document defines API authority, provider behaviour, and cost-control.

It does NOT define what users get for free vs paid.
That contract lives only in:
`C:\Users\Proma\Projects\promagen\docs\authority\paid_tier.md`

Hard rule: if it is not written in `paid_tier.md`, it is free.

0. Revision notes (why v2 exists)

This document exists because the FX ribbon only feels “alive” if the system is calm, predictable, and honest.

If you only remember one thing:

You don’t just need rules. You need authority.
A system without a gatekeeper will always “helpfully refresh” and quietly burn credits.

v2 is designed to remove implicit assumptions by:

declaring cost-control constraints as non-negotiable rules

making A/B timing explicit (no more “it was implied”)

making trace endpoints read-only by contract

forcing SSOT-aware cache keys so config changes invalidate correctly

separating client polling frequency from upstream provider frequency

embedding the FX Authority Map (decision authority) so regressions are obvious

embedding the FX NO-BYPASS CHECKLIST (audit tool) and PR review template so authority cannot silently regress

1. Core principle: rules must be enforceable

Promagen must contain exactly one authority point in the server request path that is empowered to decide:

“Serve cache; do nothing.”

“Refresh exactly one group.”

“Refuse upstream because it is forbidden right now.”

“Ride-cache because upstream failed / rate-limited.”

If this authority does not exist (or is bypassable), everything else becomes wishful thinking.

2. SSOT: what the ribbon is allowed to show

The FX ribbon pair list is SSOT and lives at:

frontend/src/data/fx/fx.pairs.json

This file is SSOT for:

which pairs appear on the ribbon

their order (used for deterministic A/B split)

any classification used for thresholds (majors vs volatile)

SSOT changes must invalidate caches immediately. No waiting for TTL to “eventually” reflect config changes.

3. Registry vs policies: single source of truth

Promagen uses:

config/api/providers.registry.json
declares providers, endpoints, capabilities, env var dependencies, and metadata

config/api/roles.policies.json
declares routing policy per role (FX, commodities, etc.), including fallback chains and caching rules

The registry describes what exists.
The policy describes how it’s used.

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
- whether missing env vars means “provider unavailable”

Capabilities

- roles supported (e.g. fx.ribbon, fx.quotes)
- bulk support (true/false)
- max symbols per bulk request (or “unknown”)
- known provider rate-limit hints (optional; enforcement still belongs to the Gate)

Endpoints (as needed)

- base URL
- route templates for bulk FX quotes
- any required query params

Normalisation expectations

- quote mapping keys (e.g. symbol format)
- time fields if provided (asOf)

  3.1.2 roles.policies.json (minimum fields)

Each role policy should be able to answer:

Identity

- role id (e.g. fx.ribbon)
- description (optional)

Caching & calm rules (normative)

- ttlSeconds (authoritative TTL enforced server-side)
- bulkOnly (must be true for fx.ribbon)
- singleFlightKeying rules (payload identity; must include SSOT fingerprint)

Provider chain (normative)

- primary provider id
- backup1 provider id (optional)
- backup2 provider id (optional)
- whether fallback is allowed when primary is forbidden vs only when it fails

FX ribbon specifics (normative; v2 default is primary-only and no cross-provider fallback)

- SSOT source path (fx.pairs.json)
- A/B split rule (even/odd indices)
- alternation rule (A then B then A…)
- cold-start priming enabled (true/false; default true for fx.ribbon)

Safety rails (normative)

- ride-cache behaviour on failure/429
- budget guard behaviour (warn/block thresholds and caps)

4. Roles: what “role” means

A role is a logical data capability: e.g.

fx.quotes

fx.ribbon

fx.trace

Roles have policies describing:

which providers can serve them (priority chain)

what caching rules apply

what behaviour is forbidden (budget blocks, missing-key blocks, trace read-only, etc.)

4.1 API Surface Index (routes → roles)

This document started as a cost-control + authority spec (the “Brain”), not a full endpoint reference.
That’s why earlier versions felt “complete” for FX but still left gaps for other endpoints.

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
| /api/auth/*                        | auth                | No (Clerk)            | no-store                 | No                            | DEPRECATED: Handled by Clerk       |
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
| /api/weather                       | weather             | No (weather)          | varies                   | No                            | Weather data                       |
| /api/world-clocks                  | world-clocks        | No                    | varies                   | No                            | World clocks                       |

4.2 Roles table (what ships, and what is governed)

A roles table is the canonical map that ties the surface index to enforcement.
If a role exists, it must have:

- provider chain (from roles.policies.json)
- TTL / caching rules (server-owned)
- bulk rules (if applicable)
- a declared definition of “forbidden” for that role (freeze windows, budget rules, auth gates)
- a trace stance (observer-only, or no trace)

Minimum roles currently relied upon by the Brain model:

| Role id   | Primary route(s) | Provider chain source                                                  | TTL / cache authority                                               | Bulk rules      | Forbidden means (examples)                     | Trace                         |
| --------- | ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------- | ---------------------------------------------- | ----------------------------- |
| fx.ribbon | /api/fx          | roles.policies.json → providers.registry.json (execution via adapters) | Server TTL is authoritative (production truth currently 30 minutes) | Bulk-only (N→1) | budget block; missing key; ride-cache cooldown | /api/fx/trace (observer-only) |
| fx.trace  | /api/fx/trace    | none (observer-only)                                                   | no-store preferred                                                  | n/a             | never calls upstream; never mutates cache      | itself                        |

fx.ribbon runtime knobs (environment variables, server-only)

- TWELVEDATA_API_KEY
- FX_RIBBON_BUDGET_DAILY_ALLOWANCE
- FX_RIBBON_BUDGET_MINUTE_ALLOWANCE
- FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS

These are deployment-critical: they must be set in the hosting environment (e.g. Vercel/Fly), not only in local .env files.

Everything else in the Surface Index is either:

- already a “role” in a different subsystem (auth/audit/admin), or
- not yet migrated under the Brain (stub/static routes), or
- awaiting explicit policy entries if it will ever trigger upstream spend.

Rule (so this doesn’t rot): if you add a new /api/\* route, you also add a row here (and if it can spend money, you also add it to roles.policies.json and route it through a Gate).

5. Provider chain: how fallback works

A provider chain is:

Primary provider

Backup 1

Backup 2

Optional “hard fail” (no more providers)

Promagen tries providers in order, stopping at first success, unless policy forbids upstream calls.

5.1 Provider catalogue detail (how to document providers so behaviour is predictable)

The registry file is where providers are declared, but this document must still define what “complete provider documentation” means.
A provider entry is only useful if you can answer, in one place, the questions that otherwise cause endless regressions.

Minimum provider catalogue fields (normative):

Identity

- providerId (stable string key used in code + responses)
- name (human readable)
- docs/website (optional)

Auth / configuration

- required environment variables (names only; never values)
- “missing key” semantics (does missing key disable the provider, or force unavailable?)

Capabilities

- which roles it can serve
- bulk support (true/false)
- bulk symbol limit (known numeric limit, or “unknown”; enforcement still belongs to the Gate)
- cost model hints (credits per request, per symbol, per endpoint) if known

Symbol format

- expected symbol grammar (e.g. FX “USD/JPY” vs “USDJPY”)
- normalisation mapping rules (how raw provider symbols map to SSOT symbols)

Known failure modes

- rate limit responses / headers
- “success” payloads that still contain errors per symbol
- partial data (missing symbols in a bulk response)
- stale timestamps / missing asOf

Normalisation rules

- how to convert provider response into Promagen’s canonical quote shape
- how to treat missing symbols (explicitly record missing in trace; never invent prices)

Concrete minimum catalogue for the current FX provider set (as implemented today):

Provider: twelvedata

- providerId: twelvedata
- env vars: TWELVEDATA_API_KEY (server-only)
- roles: fx.ribbon (and any other Twelve Data backed roles you explicitly declare later)
- bulk: yes (Promagen uses one bulk request for the ribbon payload)
- symbol format expected by Promagen SSOT + UI: "USD/JPY" style
- known failure modes to treat as normal:
  - HTTP 429 / “rate limit” → Gate applies ride-cache cooldown; trace explains budget state and last decision
  - 200 OK but missing some symbols → treat as partial data; return “—” for those chips; list missing symbols in trace
  - provider latency/timeouts → treat as upstream failure; attempt fallback chain only if policy allows

Virtual providers (not upstream, but used for provenance)

- providerId: cache
  - means values were served from server cache within TTL (or ride-cache if upstream failed)
- providerId: fallback
  - means the primary provider failed and a backup provider served (only when backup chain exists)

Do not add new providers “by code only”.
If you add a provider adapter, also add:

- providers.registry.json entry
- roles.policies.json references for any role that can use it
- a row (or sub-row) in this section stating env var name, symbol format, bulk limits, and known failure modes

6. Bulk-only FX contract (N→1)

The FX ribbon contract is:

The ribbon has an SSOT list of pairs.

The server fetches FX for the ribbon in one bulk request.

It will not fetch per-pair.

It will not allow N parallel FX requests for the same ribbon payload.

The ribbon is designed to be a “market surface language”, not a per-widget data source.

6.1 Bulk representation (policy-level expectations)

For fx.ribbon, “bulk” means:

- one upstream request per refresh decision (leader only)
- requesting the full set of required symbols in that request
- receiving a map keyed by symbol/pair id (or an equivalent structure)
- normalising to exactly the SSOT pair list (in order), with unknown prices represented explicitly (see Response Contracts)

If a provider cannot return all symbols in one request due to provider max limits, the role policy must declare the maximum and the Gate must still enforce “no extra upstream calls” per refresh decision (i.e. do not silently fall back to multiple upstream calls without an explicit policy change).

7. Single-flight: one in-flight request shared

Single-flight means:

if 10 callers request the same logical payload at the same time

only one upstream request is performed

everyone shares the same promise/result

Single-flight is a core cost-control lever and must apply at the group + payload identity level.

7.1 Single-flight scope for fx.ribbon (A, B, and cold-start priming)

For fx.ribbon the Gate must maintain three distinct single-flight scopes:

- inFlightA: one leader refresh for Group A (payload identity includes SSOT fingerprint)
- inFlightB: one leader refresh for Group B (payload identity includes SSOT fingerprint)
- inFlightPrimeBoth: one leader cold-start prime that populates both groups from one bulk upstream call (payload identity includes SSOT fingerprint)

This prevents stampedes on cold start and prevents accidental double-refresh where “A refresh” and “B refresh” happen concurrently.

9. Ride-cache on failure / 429

If upstream fails:

return cached values if available

mark them as ridden/stale in trace

do not thrash upstream with retries that violate calming rules

429 handling:

treat provider 429 as a signal to ride-cache and back off

do not hammer backups immediately unless policy explicitly allows it

9.1 Budget guard (server-owned, single source of truth)

Budget guard exists to prevent a “healthy” system from going bankrupt.

Hard rule:
Budget state is computed only inside the Refresh Gate (authority). It must not be recomputed in UI, routes, or trace. Everything else receives the computed snapshot.

9.1.1 Budget caps (defaults, overrideable)

- Daily allowance: 800 calls/day (default)
- Per-minute cap: 8 calls/minute (default)

Overrides may exist via env/config, but must be applied only by the Gate.

Day boundary must be Europe/London local day (not server UTC).

9.1.2 Budget states and thresholds (safety margin rule)

Budget.state must be one of:

- ok 🛫 (below warning threshold AND below minute cap)
- warning 🏖️ (at or above ~70% of daily allowance, but not blocked)
- blocked 🧳 (at or above ~95% of daily allowance OR minute cap is hit)

The thresholds are a safety margin:

- warning at ~70%
- block at ~95%

  9.1.2.1 Budget emoji mapping is SSOT (anti-drift rule)

The budget indicator uses emojis, but the emojis themselves must not be “free-floating constants” inside random modules.

Rule:

- The canonical budget emojis live in the Emoji Bank SSOT: frontend/src/data/emoji/emoji-bank.json
- The Emoji Bank group key is `budget_guard` and must contain exactly: `ok`, `warning`, `blocked`.
- All consumers (providers.ts, /api routes, hooks, UI components, tests) must read these via the emoji helper layer (frontend/src/data/emoji/emoji.ts) and must not define local budget emoji constants.
- There is no “unknown” budget emoji/state. Missing mappings must fail tests/builds rather than rendering a question mark.

Canonical mapping (non-negotiable):

- ok 🛫
- warning 🏖️
- blocked 🧳

Notes:

- The contract source of truth remains meta.budget.state.
- If any payload/trace includes an emoji convenience field, it must be derived from the same SSOT mapping above (no exceptions).

Lock-in proof (required):

- Add/keep a tiny integrity test that asserts: ok🛫 / warning🏖️ / blocked🧳.
  This exists purely to stop silent emoji swaps during refactors.

  9.1.3 Enforcement rules (non-negotiable)

When Budget.state is blocked:

- absolutely no upstream/provider calls for fx.ribbon (including cold-start priming)
- serve cache only (fresh or ridden)
- if no cache exists, return an honest degraded response with unknown prices (see Response Contracts)

When Budget.state is warning:

- upstream is still allowed (subject to TTL/freeze/cooldown)
- trace and meta must surface warning clearly so the system is observable

  9.1.4 Exposure rules (meta + trace + headers)

The Gate’s computed budget snapshot must be passed through to:

- /api/fx response meta (budgetState + counters useful for observability)
- /api/fx/trace payload (same snapshot)
- response headers (optional, but useful for ops)

No other file should compute or infer budgetState.

9.2 Non-FX budget rules (role-scoped, not FX-shaped by accident)

The budget machinery in Promagen exists to stop “helpful refresh” from becoming an invoice.
FX shaped the design, but the rule is global:

Budget is a Gate-owned decision, and it is role-scoped.

If a different role has a different cost model, it must declare that model explicitly, otherwise you will accidentally enforce the wrong thing.

Examples of cost model differences you must document per role:

- “credits per request” (flat)
- “credits per symbol” (bulk call cost scales with N)
- “credits per endpoint” (one provider has multiple endpoints with different prices)
- “free tier vs paid tier” (free-tier limits vs paid entitlements behaviour)

Normative rule:

- Each role policy declares (or references) its cost model (even if the model is “flat per call”).
- The Gate computes a single shared budget.state (ok/warning/blocked) per role per provider chain, and that one state is what UI/trace/headers reflect.
- Warning and block thresholds must use your margin rules (warn ~70%, block ~95% of the declared allowance), but the exact allowances remain role-defined.

If a role has no budget policy, that is still a policy: it must say “no budget enforcement” explicitly, otherwise the implementation will drift.

10. Trace endpoints: observation only

Trace endpoints are for observation, not action.

/api/fx/trace must never trigger upstream refresh.

It must expose:

cache timestamps

last refresh group

which group would be eligible now

provider health / fallback history

whether upstream was called for the request (it should be no for trace)

10.1 Trace caching rule

Trace is diagnostics. It should generally be returned with no-store semantics (or equivalent) so caches/CDNs do not serve misleading debug state.

11. Cache policy: why we cache

FX endpoints can be surprisingly expensive on plan limits.
Caching reduces spend, smooths traffic, and improves perceived performance.

But the deeper reason is structural:

Caching is how we create authority.
If the system can always say “use what we already know”, it can also say “no, not yet”.

12. Cache TTL: the rule

Cache TTL is defined in the role policy.

Two consequences follow, and they are non-negotiable:

Server TTL is authoritative.
If the server says the TTL has not expired, upstream must not be called — regardless of client polling.

Cache headers must be honest.
If the server TTL is 30 minutes, we do not emit headers implying 5 minutes “freshness” (or vice versa).
CDN behaviour must match what the server is prepared to enforce.

13. Cache layers (what is cached, and at what granularity)

Promagen’s FX ribbon caching is intentionally layered:

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

Trace must never “helpfully” trigger a refresh. It is observation only.

This layering is what makes “merged A+B response” compatible with “only one group refreshes per refresh cycle”.

13.1 Cache object schema (normative) — what each layer must contain

This section defines minimum fields the system must track so the behaviour is testable and debuggable.

13.1.1 Group cache entry (A or B)

A group cache entry must carry:

Identity

- role (fx.ribbon)
- groupId (A or B)
- ssotFingerprint (hash/fingerprint of ordered SSOT ids)

Quote payload (normalised)

- quotes: map keyed by SSOT pair id, where each quote contains:
  - pairId
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
- include all SSOT pairs (never drop pairs)
- for each pair include price or explicit unknown (null)

Merged output may be:

- assembled on request from group caches, or
- stored as a derived cache entry

If stored, its cache identity must still include the ssotFingerprint and must not introduce new upstream work.

14. Cache keys: SSOT-aware, deterministic, safe

To honour SSOT as the single source of truth, caching must be SSOT-aware.

Promagen must ensure cache keys incorporate the SSOT ribbon set identity, so that:

Changing src/data/fx/fx.pairs.json invalidates the cached ribbon result immediately

You never have to wait for TTL to see a config change reflected

Two different ribbon configurations can never share a cache entry by accident

Policy-level expectations:

Cache key must include a stable fingerprint of the ribbon SSOT list (e.g. hash of the ordered ids)

The fingerprint must be based on ordered ids, not labels

Group cache keys must include: {role}:{environment}:{ssot_fingerprint}:{group_id}

15. CDN-honest headers (the “no lying” rule)

When returning /api/fx:

Cache-Control must reflect the server TTL you are enforcing (e.g. s-maxage=<ttlSeconds>)

Avoid headers that imply background revalidation unless you can guarantee it will not create upstream work

If you use stale-while-revalidate, it must revalidate against your own server cache, not upstream providers

Cache headers are a promise. Promagen must only promise what the Refresh Gate can keep.
Client fetch stance (anti-regression)

- `/api/fx` must be cacheable end-to-end. Client code must not set `cache: 'no-store'` / `reload`, add `Cache-Control: no-cache`, or append cache-busting query params.
- Client requests for `/api/fx` should be cookie-free (use `credentials: 'omit'`) unless the endpoint truly requires auth cookies (cookies fragment/bypass edge caching).
- `/api/fx/trace` should prefer `Cache-Control: no-store` and must never trigger upstream work.

#### Vercel Pro hardening for `/api/fx` (cost + abuse control)

- Canonical playbook: `C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md`
- Platform guardrails (Pro):
  - Spend Management thresholds (alerts + pause production deployments at cap).
  - WAF rules on `/api/fx` (and any paid-upstream endpoints) to block bots and rate-limit bursts.
- Code guardrails (defence in depth):

  - CDN-honest cache headers aligned with TTL (so edge caching actually happens).
  - Single-flight / de-dup so concurrent hits do not stampede upstream APIs.
  - `PROMAGEN_SAFE_MODE=1` to force cache/demo only; provider kill switches (e.g. disable TwelveData) for emergency response.

    15.1 Trace caching (diagnostics must not be misleading)

When returning /api/fx/trace:

- prefer no-store semantics so CDNs do not cache debug state
- if caching is unavoidable, it must be extremely short and explicitly labelled

  15.2 Header standards (global, consistent across routes)

Headers are part of the API contract.
If two endpoints speak different dialects for the same concept, your UI and your debugging tools will lie to you.

Minimum header standards (normative):

- Cache-Control must match the Gate’s promise (no implied background revalidation that would create upstream work)
- Content-Type: application/json; charset=utf-8 (for JSON routes)
- A role identifier header for all Brain-governed routes (so logs and client traces can group correctly):
  - X-Promagen-Role: <role id> (e.g. fx.ribbon)
- Provenance headers for Brain-governed routes (reflective, not authoritative):
  - X-Promagen-Mode: live | cached | fallback (fallback only when role policy permits it; fx.ribbon is currently live|cached only)
  - X-Promagen-Provider: <providerId>
  - X-Promagen-AsOfMs: <unix ms timestamp>
- Budget headers for Brain-governed routes (reflective; computed by Gate):
  - X-Promagen-Budget-State: ok | warning | blocked
  - X-Promagen-Budget-WarnAt: <number> (optional)
  - X-Promagen-Budget-BlockAt: <number> (optional)

Trace endpoint headers (diagnostics stance):

- Trace should prefer Cache-Control: no-store (so you never debug stale diagnostics)
- If any caching exists, it must be explicit and extremely short

Non-Brain routes:

- May omit provenance/budget headers, but must not fake them.
- If they later become spend-bearing, they must be migrated under a Gate and start emitting consistent headers.

Rule:

- Headers are reflective information. They do not grant permission. Only the Gate grants permission.

16. Implementation expectations (server route)

The server route must:

enforce TTL and group refresh rules

enforce single-flight

enforce bulk-only FX requests

emit honest cache headers

never let trace trigger upstream

ensure UI polling cannot increase upstream spend

16.1 Platform gotchas (Next.js / Vercel / serverless) — avoid accidental regressions

This section exists because platform defaults can silently break authority.

In-memory caches

- In-memory caches are per-process. On serverless they may reset on cold start and may not be shared across concurrent instances.
- Therefore, “cold start priming” should be expected to happen per new instance (still protected by single-flight per instance).
- If you need global cross-instance coherence, you must introduce shared storage (Redis/KV) deliberately and update the doc.

Runtime

- If the system relies on in-memory caching, fx.ribbon endpoints must run in a Node.js runtime where the cache is process-local and stable for the lifetime of the instance.
- Edge runtimes can behave differently; do not silently switch to Edge for fx.ribbon without revisiting authority and cache semantics.

Fetch caching defaults

- Avoid implicit caching behaviour that bypasses the Gate.
- Provider calls must remain under Gate control; any framework-level fetch caching must not create upstream work outside the Gate decision.

Trace and CDN

- Ensure /api/fx/trace is not cached by CDN defaults.
- Debug endpoints that are cached create false confidence and waste time.

  16.2 Security / auth boundaries (what is allowed from client, what must remain server-only)

A lot of “mysterious bugs” are actually boundary violations.
This section makes the boundary explicit so you don’t accidentally leak secrets or let client input mutate authority.

Normative security rules:

- Provider credentials (API keys) are server-only. They must never be exposed to the client bundle.
- Client requests must never be allowed to:
  - choose a provider
  - choose Group A/B
  - choose TTL
  - force refresh
  - disable freeze windows or budget blocks
- Any dev/admin endpoints must be explicitly gated (by environment or auth) and must default to off in production.
- Trace UI exposure is a UI policy, not a route policy:
  - The /api/fx/trace route can exist for operational debugging,
  - but the homepage must not surface it in production unless explicitly enabled by a secure flag.

Auth-bearing routes (login/logout/me) are a separate security subsystem.
They must never be wired into the Brain in a way that would allow a role policy change to affect authentication behaviour.

> **Note (Jan 2026):** Authentication is now handled by **Clerk**. The legacy `/api/auth/*` routes are deprecated.
> Clerk middleware (`clerkMiddleware`) handles session validation and route protection.
> See `docs/authority/clerk-auth.md` for implementation details.

17. Addendum: Runtime Contract (FX ribbon role)

This addendum is the operational contract that ties together registry + policies + server enforcement and makes the “calming rules” testable.

Production TTL authoritative in production: 30 minutes

Current production setting (TRUTH ANCHOR): TTL = 30 minutes (1800 seconds).

This value is enforced server-side (see providers.ts) and must remain 30 minutes unless you explicitly approve a change.

This TTL is the spend governor: it is what empowers the server to say “no, not yet” to any upstream call.

Optional tuning note (NOT current production): TTL changes are a deliberate cost-control decision; production truth remains TTL = 30 minutes (1800 seconds) unless explicitly approved and documented.

Any TTL change is a documented tuning option only (not production truth unless explicitly approved).

Keep all docs aligned to the approved production TTL value (currently 30 minutes); do not cite alternative TTL numbers as “targets”.

Important: Promagen has two different time concepts that people accidentally mix up:

Client polling cadence (how often the browser asks Promagen for data, e.g. every N seconds)

Upstream refresh cadence (how often Promagen is allowed to hit paid providers)

Those are related only because client requests create opportunities to refresh — but the Refresh Gate + server TTL decide whether a refresh is allowed.

17.1 Goals

FX ribbon should feel alive while remaining calm

Upstream spend must be deterministic and bounded

Widget count must not affect upstream spend

Trace must provide full observability without side effects

17.1.0 Unified Error & Degradation Contract (global)

This document originally defined FX contracts, but the same shape must apply across all spend-bearing roles.
Without a unified contract, every new role invents new error fields and the UI becomes a tangle of special cases.

Canonical rule:

- Every Brain-governed route returns a consistent envelope that can represent: live, cached, fallback (only when role policy permits), partial, blocked, forbidden, and unavailable.
- The envelope is descriptive. It MUST NOT be used by clients to infer permission or to decide refresh behaviour.

Recommended canonical envelope fields (normative names; exact TS types may vary):

- role: string (role id, e.g. "fx.ribbon")
- mode: "live" | "cached" | "fallback" (fallback is role-policy-gated; fx.ribbon currently forbids cross-provider fallback)
- providerId: string (which provider ultimately served the values; "cache" and "fallback" are allowed virtual values)
- asOfMs: number (unix ms timestamp representing the data timestamp Promagen is willing to stand behind)
- stale: boolean (true if values are older than ideal freshness, but still being served intentionally)
- errorTag?: string (machine-readable tag; examples below)
- warnings?: string[] (human-auditable strings; short)
- meta?: object (role-specific metadata that never grants permission)

Standard errorTag taxonomy (recommended):

- ok (implicit when errorTag is absent)
- partial (some symbols missing; values present where possible; missing values shown as "—")
- forbidden (role policy forbids upstream right now: missing key, manual disable, etc.)
- blocked (budget state blocked; upstream refused)
- upstream_failed (upstream attempt failed and no fallback succeeded)
- unavailable (no live values and no usable cache; render stable layout with “—”)

Rule:

- /api/\* routes may choose to use HTTP status codes, but the envelope must still be present for client stability (stable rendering and clear provenance).
- Trace endpoints return a richer diagnostic payload, but must still not mutate state and must remain observer-only.

  17.1.1 API response contracts (normative) — so behaviour is testable

This section defines the minimum contract for /api/fx and /api/fx/trace. It is intentionally concrete, but does not force a specific TS type layout.

17.1.1.1 /api/fx (fx.ribbon) response contract

The response must always represent the full SSOT list in SSOT order.

Minimum required fields:

- role: "fx.ribbon"
- ssot:
  - fingerprint: string
  - pairs: array in SSOT order, each item at minimum includes:
    - id (pair id; stable SSOT key)
    - base (e.g. USD)
    - quote (e.g. JPY)
- quotes: array in SSOT order, same length as ssot.pairs, each item includes:
  - pairId: string (must match ssot.pairs[i].id)
  - price: number OR null (null means explicitly unknown; never omit the item)
  - asOfMs: number OR null (null only if price is null)
  - providerId: string OR null (null only if price is null)
  - mode: string (live | cached | fallback | blocked | frozen | degraded)
  - stale: boolean (true if ridden cache or forbidden-state output)
- meta:
  - buildId (or equivalent)
  - asOfMs (best-known asOf across quotes; may be null on fully unknown)
  - ttlSeconds (the authoritative TTL for fx.ribbon)
  - budget:
    - state: ok | warning | blocked
    - optional counters (usedToday, limitToday, usedThisMinute, minuteLimit)

Unknown prices:

- If the system cannot legally or practically obtain a price, it must return price: null for that pair, not drop the pair.
- UI is expected to render null as "—" while keeping the chip present.

  17.1.1.2 /api/fx/trace response contract

Trace must never trigger upstream calls and must never mutate state.

Minimum required fields:

- role: "fx.trace"
- ssot:
  - fingerprint: string
  - pairCount: number
- budget: (same snapshot computed by the Gate)

- caches:
  - groupA:
    - present: boolean
    - seeded: boolean (if present)
    - asOfMs: number (if present)
    - expiresAtMs: number (if present)
    - providerId: string (if present)
    - quoteCount: number (if present)
  - groupB: same fields
- scheduling:
  - lastRefreshGroup: A | B | null
  - nextScheduledGroup: A | B
  - cycleSpentAtMs: number | null
- singleFlight:
  - inFlightA: boolean
  - inFlightB: boolean
  - inFlightPrimeBoth: boolean
- upstream:
  - calledByTrace: false (always)
  - lastUpstreamAttemptAtMs: number | null
  - lastUpstreamResult: success | failure | forbidden | rate_limited | none

Headers:

- Trace should be served with no-store semantics (or equivalent).

  17.2 Hard guarantees (must remain true)

/api/fx is served from server cache when TTL is valid (no upstream call).

/api/fx never performs per-pair upstream calls (bulk only).

/api/fx uses single-flight so concurrent callers share one in-flight result.

/api/fx always returns the merged A+B ribbon set (never half a ribbon); on cold start, the Refresh Gate must prime both groups in a single bulk call so the first response is complete.

Cache headers must reflect the server TTL policy for edge friendliness (without lying about freshness).

/api/fx/trace must remain read-only (no upstream calls), and must expose the diagnostics required to explain failures.

17.2.1 API calming rules (canonical list — non-negotiables)

These are the full set of calming rules you have been enforcing. They are listed here as a single checklist so we can point tests at them and stop “accidental spend” caused by UI polling, widget count, or well-meaning refresh logic.

Server-side behaviour (authority, caching, spend):

Server-side TTL caching (no upstream calls within TTL)

TTL is authoritative (client polling must not imply upstream frequency)

Single-flight upstream requests (one in-flight call shared)

Bulk-only FX requests (N→1, never per-pair)

Explicit ban on N parallel FX calls (one bulk request only)

A/B slicing and refresh rhythm:

Group A / Group B slicing (refresh only half the symbols per refresh cycle)

Deterministic group selection (no random or request-driven choice)

A/B alternation (same group must not refresh twice in a row)

A/B switching only on TTL expiry (no mid-TTL refresh)

“Only one group refreshes per refresh cycle” (the enforcement point)

Client behaviour (polling, widgets, perception):

Centralised client polling (multiple widgets ≠ multiple /api/fx calls)

Client polling decoupled from upstream refresh

No client-side timers controlling upstream

No cron-driven upstream refresh

No per-request “always refresh” behaviour (requests must be able to be served from cache)

Failure handling / safety rails:

Ride-cache on provider failure / HTTP 429

Trace endpoint read-only (must never trigger upstream)

Upstream auth strictly server-side

SSOT and output guarantees:

SSOT-keyed cache invalidation (pairs.json change forces new cache)

Merged A+B response (always show full ribbon set)

CDN-honest cache headers (reflect server TTL, no lying)

These rules must be simultaneously true — and the Refresh Gate is the only thing allowed to decide upstream work.

17.2.2 Authority layer: the Refresh Gate (“no, not yet”)

The problem in one sentence:

You have rules, but you do not have authority.
Nothing in the system is empowered to say “no, not yet” to an upstream call.

To fix this properly, Promagen must have exactly one server-side authority point (the Refresh Gate) that decides, for every /api/fx request:

“Serve cached; do nothing upstream.”

“Refresh exactly one A/B group (bulk, single-flight).”

Upstream is forbidden right now (policy/budget) — serve cache only.

“Upstream failed / 429 — ride-cache and back off.”

That is why you do not need an explicit ‘time between A and B’ timer in application code: the Gate enforces time using cache timestamps + TTL + deterministic group eligibility.

Non-negotiable responsibilities of the Refresh Gate:

Know the rules (from SSOT + role policy)

TTL (current production: 30 minutes)

A/B slicing and deterministic selection

“Only one group per refresh cycle”

Single-flight (one in-flight promise per group + payload identity)

Budget guard (warn/block thresholds and caps; computed once)

Decide whether upstream is allowed

If request is trace (/api/fx/trace) → upstream is never allowed

If budget is blocked → upstream is never allowed (including priming)

If group cache is within TTL → upstream is not allowed (“no, not yet”)

If upstream recently failed / returned 429 → upstream may be temporarily denied and we ride-cache

Guarantee the cost model

A client can poll /api/fx every 2 seconds and it must not change upstream spend.

Multiple widgets mounting must not multiply network calls (client-side centralisation) and must not multiply upstream calls (server-side gating + single-flight).

Return something sane in every outcome

Fresh merged A+B response when a refresh happened

Warm cached merged response when TTL is valid

Stale-but-usable merged response when upstream is down (with trace flags showing it is stale/rode-cache)

Honest degraded response when upstream is forbidden and cache is empty (unknown prices, not missing pairs)

17.2.3 FX Authority Map (decision authority — gold standard)

This is the authority map — not data flow, not components — decision authority.
Read it as who is allowed to decide, not who merely calls whom.

Absolute rule

Only ONE box is allowed to decide when an upstream FX call happens.
Everything else is informational or observational.

The map (top → bottom)

1. FX Role Policy (Brain)

Role: Lawmaker
Decides:

TTL duration

Grouping rules (A/B)

Provider choice

Constraints (bulk-only, budget guardrails, etc.)

Cannot:

Execute anything

Observe runtime

Trigger refresh

Provides rules to…

2. FX Refresh Authority (the Refresh Gate) (THE KEY BOX)

Role: Judge + Gatekeeper
Decides:

Whether an upstream call is allowed now

Whether TTL has expired

Whether we are in cooldown / ride-cache

Whether budget allows upstream (ok/warning/blocked)

Which group (A or B) may refresh

Whether a call is already in-flight (A/B/primeBoth)

Can say:

“Yes, refresh Group A now”

“No, serve cache”

Cannot:

Be bypassed

Be duplicated

Be influenced by traffic volume

If and only if it says “yes”…

3. FX Provider Adapter

Role: Execution engine
Decides:

Nothing

Does:

Perform exactly one bulk request

Normalise provider response

Throw if invalid

Returns result to…

4. FX Cache Store

Role: Memory
Stores:

Last good data

Expiry time

Last refreshed group

SSOT fingerprint

Cooldown / ride-cache state

Budget ledger state (if in-memory)

Decides:

Nothing

Hard rule:
Read/write only by the Authority (the Refresh Gate)

Observers (NO AUTHORITY)

5. /api/fx Route

Role: Courier
Does:

Ask Authority for current state

Return merged A+B response

Cannot:

Trigger refresh

Decide freshness

6. /api/fx/trace Route

Role: Inspector
Does:

Read Authority state

Expose diagnostics

Hard rule:
Never mutates
Never refreshes

7. Client Hooks / Polling

Role: Noise generator
Does:

Ask for data repeatedly

Important:
Traffic ≠ permission

8. UI Components

Role: Renderer
Does:

Display whatever it receives

Knows nothing about:

TTL

A/B

Providers

Costs

9. CDN / Edge

Role: Amplifier
Does:

Cache based on headers

Trusts:

Server authority completely

Illegal paths (these must NEVER exist)

UI → Provider

Hook → Provider

Route → Provider

Trace → Authority mutation

Client → Freshness decision

Cron → Provider

Traffic volume → Refresh permission

If any of these paths exist, the system will hammer upstream again.

Why this map is “gold standard”

Because:

Time exists in one place

Permission exists in one place

Memory exists in one place

Execution is dumb

Traffic is powerless

This is how real market data systems stay solvent.

Lock this in (important)

If you ever ask in future:

“Why did this refresh?”

There should be exactly one answer:

“Because the FX Refresh Authority (Refresh Gate) allowed it.”

If there is a second answer, the design has regressed.

17.2.4 FX NO-BYPASS CHECKLIST (authoritative)

This is the audit tool.
Apply it to any file in 30 seconds and know if it breaks authority.

If any answer is YES, the file breaks authority.

Authority & Time

Does this file decide when an upstream call happens?

Does it compare now to TTL or expiry?

Does it flip Group A/B outside the TTL edge?

Does it infer freshness from traffic, polling, or request count?

Upstream Control

Can this file directly call an FX provider?

Can it indirectly trigger a provider call via helper logic?

Can it trigger refresh without passing through the Authority?

Can it start a second upstream call while one is in flight?

State & Memory

Does this file mutate cache, expiry, or group state?

Does it store or compute “last refresh” independently?

Does it generate cache keys that vary per request?

Does it ignore or overwrite SSOT fingerprints?

Client / Route Violations

Does a client hook decide freshness or refresh timing?

Does /api/fx decide to refresh instead of asking?

Does /api/fx/trace mutate state or trigger refresh?

Does UI logic affect upstream behaviour?

Scheduling & Timers

Does this file use:

cron

intervals

timeouts

minute-based parity

request counters

to influence upstream calls?

Bulk & Cost Rules

Can this file issue per-pair FX calls?

Can this file issue parallel FX calls?

Can this file bypass bulk-only enforcement?

Can it retry upstream outside ride-cache rules?

Environment & Headers

Does this file change TTL behaviour based on client input?

Does it emit cache headers that don’t match server TTL?

Does it expose provider auth or secrets?

Budget

Does this file recompute budget state outside the Gate?

Does it allow upstream calls when the Gate says blocked?

The only acceptable answers

A correct file must satisfy ALL of these:

Cannot decide time

Cannot decide permission

Cannot call providers

Cannot mutate FX state

Cannot infer freshness

Cannot recompute budget state

Can only ask the Authority

Can only render / return data

One-line enforcement rule (memorise this)

If a file can cause an upstream FX call without passing through the FX Refresh Authority (Refresh Gate), it is wrong.

17.2.5 PR review template (no-bypass guardrail)

This is the practical “regression stopper”.
Paste it into a PR description or code review and tick it off.

NO-BYPASS PR CHECK (FX)
Docs Gate (PR template requirement)

[ ] Docs Gate: Yes/No + Target doc + insertion point (must be present in every PR description).

Authority

[ ] Only the Refresh Gate can decide whether upstream is allowed.
[ ] No other file compares now() to TTL/expiry or decides freshness.
[ ] No other file selects Group A/B outside the Gate.

Upstream

[ ] No UI/hook/route/trace code calls any provider directly.
[ ] Provider adapters remain execution-only (bulk request + normalise + validate/throw).
[ ] Single-flight is preserved (no parallel upstream for same payload identity).

State

[ ] Cache/expiry/group state is mutated only by the Refresh Gate.
[ ] Cache keys remain deterministic and SSOT-fingerprint-aware.
[ ] No new per-request cache key variation has been introduced.

Trace

[ ] /api/fx/trace is read-only: no refresh, no mutation, no provider calls.
[ ] Trace exposes enough diagnostics to explain “why refresh happened”.
[ ] Trace is not cached by CDN defaults (no-store preferred).

Client pressure

[ ] Polling frequency changes do not change upstream spend.
[ ] Adding widgets does not increase /api/fx calls linearly (client centralisation intact).

Spend

[ ] Bulk-only still holds (no per-pair upstream calls).
[ ] Ride-cache rules are unchanged and enforced.
[ ] Budget guard thresholds are enforced by the Gate (warn ~70%, block ~95% or minute cap).

One-line enforcement

[ ] If a file can cause an upstream FX call without passing through the Refresh Gate, it is wrong.

17.2.6 Docs lint (contradiction guardrail)

This exists to stop old, wrong wording from creeping back into this document and silently corrupting the implementation.

Rule:

Additional enforcement (Doc Delta gate)

- Any PR that changes authority areas (starting with frontend/src/lib/fx/\*\*) must include a Doc Delta note in the PR description/changelog.
  The Doc Delta note must name: Target doc + exact insertion point (line/heading) + what text will be added.

Planned CI follow-up (docs-lint, later)

- Add a small CI check that fails if the diff touches frontend/src/lib/fx/\*\* (or other declared authority areas) and the PR body/changelog does not contain a Doc Delta note.

- The canonical truth is defined in section 17.3. No other section is allowed to redefine A/B slicing or scheduling.
- Any PR that changes this document must run a quick scan and fail review if legacy scheduling language appears outside the ignore block below.

<!-- DOCS_LINT_IGNORE_START -->

Forbidden legacy patterns (regex, case-insensitive; any match outside this ignore block is a regression):

- first\s+half
- second\s+half
- T\s*/\s*2
- slot\s+number
- candidate\s+group
- minute\s+parity
- time[-\s]\*derived\s+selection
- k\s*=\s*floor
- refresh\s+slot\s*=\s*S

PowerShell check (repo root):

```powershell
$doc = "promagen-api-brain-v2.md"
$raw = Get-Content -Raw $doc

# Remove the ignore block so the forbidden patterns listed below don't self-trigger.
$ignore = "<!-- DOCS_LINT_IGNORE_START -->.*?<!-- DOCS_LINT_IGNORE_END -->"
$scan = [regex]::Replace(
  $raw,
  $ignore,
  "",
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

$badPatterns = @(
  'first\s+half',
  'second\s+half',
  'T\s*/\s*2',
  'slot\s+number',
  'candidate\s+group',
  'minute\s+parity',
  'time[-\s]*derived\s+selection',
  'k\s*=\s*floor',
  'refresh\s+slot\s*=\s*S'
)

$opts = [System.Text.RegularExpressions.RegexOptions]::IgnoreCase

foreach ($pat in $badPatterns) {
  if ([regex]::IsMatch($scan, $pat, $opts)) {
    throw "Docs lint failed: found forbidden legacy pattern: $pat"
  }
}

"Docs lint ok"
```

<!-- DOCS_LINT_IGNORE_END -->

17.3 Group A/B caching contract

CANONICAL TRUTH: Group A/B = even/odd SSOT indices; scheduling = Gate-owned alternation by spent cycle; cold-start priming = one bulk call populating both caches (seeded semantics) — no wall-clock parity and no “slot” maths.

The ribbon SSOT list is deterministically split into:

Group A: even indices of the SSOT list (0, 2, 4, 6, …)

Group B: odd indices of the SSOT list (1, 3, 5, 7, …)

On each refresh opportunity, the server may refresh at most one group.
The client still receives the merged A+B payload.

Forbidden selection: random, request-driven, “whichever group is coldest”, etc.
Allowed: deterministic Gate-owned alternation (cycle/counter based), so everyone agrees and tests can verify it.

17.3.0 Alternation invariants and “cycle spent” (the hard definition)

This is the invariant that prevents accidental double-refresh and keeps alternation honest.

Definitions:

- A refresh cycle is “spent” only when the Gate’s single-flight leader performs an upstream call (success or failure is still an attempt; the Gate owns the outcome).
- Serving cache does not spend a cycle.
- Trace does not spend a cycle (trace is read-only).

Cycle spent updates must occur exactly once per upstream attempt:

- lastRefreshGroup updates to the scheduled group for that attempt
- cycle counter increments (if used)
- lastUpstreamAttemptAtMs updates
- any cooldown / failure state updates (as applicable)

Cold-start priming spends exactly one cycle:

- it performs exactly one upstream bulk call
- it updates cycle spent markers once
- it must not create an immediate second refresh opportunity

  17.3.1 A/B timing (the explicit bit: ‘time between A and B’)

This is the line in the sand that avoids the “it was implied” argument forever.

Key idea: Promagen does not run a cron job to refresh FX. There is no background timer that “fires Group A then waits then fires Group B”.

Instead, refresh happens only when a request arrives, and the Refresh Gate answers two questions:

Which group is scheduled for this refresh cycle? (deterministic Gate-owned alternation)

Is that group allowed to go upstream? (TTL / freeze / ride-cache / budget rules)

Define:

Group refresh TTL = T (current production truth: T = 30 minutes)

Refresh cycle = one opportunity to perform at most one upstream call, spent only when the Gate actually goes upstream (single-flight leader).

Deterministic scheduling (conceptual; the implementation may vary, but must remain deterministic):

The Gate alternates the scheduled group per spent cycle (A then B then A…), using Gate-owned state (e.g. last refreshed group / cycle counter), not wall-clock parity.

Now the enforcement:

Only the scheduled group may refresh on that request.

The scheduled group may refresh only if its own group cache is expired (older than T).

Therefore, with steady client polling, the earliest the system can refresh the other group is after the next TTL window in the same deterministic A/B alternation.

Worked example (current production truth: T = 30 minutes):

Time (relative) Scheduled group Upstream allowed? Result
T = 0 A Yes (cold / expired) Refresh Group A (bulk, single-flight)
T = 30m B Yes (cold / expired) Refresh Group B (bulk, single-flight)
T = 60m A Yes (A now expired) Refresh Group A
T = 90m B Yes (B now expired) Refresh Group B
… … … …

Effective result (when the system is warm and requests keep arriving):

~30 minutes between Group A and Group B hitting upstream

~60 minutes between same-group refreshes

Two important honesty notes:

If the client stops making requests, there is no guarantee any refresh happens “on schedule”. The Gate does not invent traffic. This is fine: no requests means no UI needing freshness.

If a refresh is forbidden (budget blocked) or a provider is rate-limiting (429), the Gate serves cache and does not try to “catch up” by firing extra upstream calls later.

17.3.2 Why the code does not need a dedicated ‘delay between A and B’

The “time between A and B” is not a separate timer because it is a consequence of three enforced facts:

TTL is authoritative per group (no upstream within T)

Only one group is eligible per refresh cycle (deterministic Gate-owned alternation)

Client polling provides the opportunity to evaluate eligibility regularly

In other words, A and B don’t “know when to trigger”. The Gate knows when upstream is permitted, and it only ever permits one group at a time.

17.4 Merged response guarantee

Even though only one group refreshes per refresh cycle:

the API response must always contain the full ribbon set

it does so by merging the most recent Group A cache and Group B cache

The client is never allowed to “see half a ribbon”.

On cold start (both group caches empty), the Refresh Gate must prime both groups in a single bulk upstream call so this guarantee still holds.

17.4.1 Cold-start priming (normative mechanics)

Eligibility (exact condition):

- Priming is eligible only when:
  - Group A cache is empty AND Group B cache is empty
  - for the current ssotFingerprint
- “Empty” means no serveable entry for that group under the current ssotFingerprint.

Action (exact requirement):

- Perform exactly one bulk upstream fetch for all SSOT pairs.
- Do not perform separate upstream calls for A and B.
- Do not perform per-pair upstream calls.

Write-through:

- Normalise the upstream result to the full SSOT set.
- Split into Group A (even indices) and Group B (odd indices).
- Write both group caches in the same pass.

Single-flight:

- Priming must be protected by inFlightPrimeBoth so concurrent cold-start requests share one upstream call.

Cycle spent:

- Priming spends exactly one refresh cycle (updates the same cycle spent markers as a normal refresh).
- It must not immediately permit a second refresh because “both groups are now fresh”.

Forbidden-state behaviour (budget blocked / cooldown):

- If priming is eligible but upstream is forbidden, the system must still return the full SSOT set.
- Prices must be explicit unknowns (price: null) for any pair not present in cache.
- Meta.mode must honestly reflect forbidden/degraded state (blocked/frozen/degraded) and trace must explain why.

  17.4.2 Seeded cache semantics (servable but not refresh-blocking)

Problem:
If priming writes both group caches as “fresh enough to block refresh”, alternation can stall (the next scheduled refresh is skipped for too long).

Solution:
Introduce seeded (authority-only) on group cache entries.

Rules:

- A seeded cache entry is serveable (used for merged output).
- A seeded cache entry must not block the next scheduled refresh for that group when it becomes scheduled.
- The scheduled group cache created during priming is seeded=false (it counts as the “real” refresh for that cycle).
- The other group cache created during priming is seeded=true (renderable now, but it must refresh the next time it is scheduled).

Outcome:

- Initial start-up returns a fully populated ribbon (when upstream is allowed and provider returns values).
- Subsequent requests alternate A/B normally without extra upstream calls.

  17.5 Trace contract

Trace must expose enough state to explain:

current TTL values in effect

cache warm/cold for A and B

last refresh time for each group

whether upstream was called for this request

which provider was chosen + fallback history

whether ride-cache is active due to failures/429

budget snapshot (state and caps) as computed by the Gate

seeded/primed visibility (so “why did it not refresh yet?” is answerable)

Trace must never trigger refresh. Ever.

18. Testing expectations (must prove calming rules)

Promagen must have tests that prove:

multiple widget mounts do not cause multiple /api/fx calls

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

bulk-only contract is maintained (no per-pair upstream calls)

single-flight is active under concurrency

19. Client contract (FX ribbon)
    19.1 Centralised polling

One poller for the entire ribbon.

Widgets consume shared state.

Polling frequency does not imply upstream frequency.

19.2 Reduced motion

Respect reduced-motion preferences.

If reduced motion is enabled, animation must soften or disable.

19.3 Thresholds + hysteresis (direction arrow)

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

Changing pairs.json updates what is displayed.

Server must treat it as a new cache identity.

19.7 Single source of truth for polling

Polling interval and shared state should live in one hook/store/context.

If you add a widget and /api/fx call count increases linearly, that is a bug.

19.8 Optional movement fields (for “alive” UX, without extra upstream calls)

Promagen may expose optional movement fields computed from cached/baseline state:

baseline24h, change24h, changePct24h

winnerSide24h and a numeric confidence (0..1)

These must be:

derived from internal state/caches where possible

stable across cached vs live modes (or explicitly labelled)

stable when quotes are unchanged (no side flipping while prices are not updating)

They are optional; the system remains correct without them.
