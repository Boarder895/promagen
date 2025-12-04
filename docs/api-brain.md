Promagen API Brain – Design Doc (v1) 0. Goal
Promagen talks to multiple third-party APIs (FX, crypto, commodities, equities, oil, misc data).
We want:
• One clear mental model of all providers, endpoints and roles.
• A small set of JSON config files that describe this “API brain”.
• Automated tests that guarantee we never accidentally blow free-tier quotas or misconfigure a provider.
This document is the human-readable spec for that API brain.
All future JSON files and tests should be directly derivable from this doc.

---

1. Core concepts
   1.1 Providers, endpoints, roles, policies
   • Provider
   A company/platform you have an account with
   (e.g. Twelve Data, ExchangeRate-API, FMP, API Ninjas, Oil Price API, ExchangeRate.host).
   • Endpoint
   A specific HTTP path on a provider’s API that Promagen might call, with a method and parameters
   (e.g. Twelve Data /exchange_rate, /currency_conversion, /cryptocurrencies).
   • Role
   A Promagen-specific label that says what job this endpoint does in the product.
   Examples:
   o fx-ribbon-realtime – “get live FX for the homepage ribbon”.
   o crypto-asset-catalog – “fetch the full list of crypto pairs”.
   o exchanges-stock-catalog – “fetch the list of stock exchanges”.
   Multiple providers can implement the same role (primary + backups).
   • Policy
   Rules about how often we call something, which provider is primary for each role,
   and safe call budgets based on free-tier limits.

---

2. The three main JSON “brains”
   All config lives under:
   src/data/api/
   2.1 api.providers.catalog.json – who we talk to
   One row per provider account.
   Purpose
   • Central list of all providers Promagen can use.
   • Records their plan, quotas and base URLs.
   • No per-endpoint details here.
   Key fields (per provider)
   • id – short, stable identifier, eg:
   o twelvedata
   o exchangerateapi
   o exchangeratehost
   o apininjas
   o fmp
   o oilpriceapi
   • name – human name, e.g. "Twelve Data".
   • website – main marketing/docs website.
   • dashboard_url – the page you screenshot for usage/plan.
   • base_url_rest – base URL for REST API, e.g.
   "https://api.twelvedata.com", "https://v6.exchangerate-api.com".
   • plan_name – e.g. "Free", "Basic B".
   • quota – normalised quotas, e.g.:
   o per_day:
    max_calls – numeric; 0 if not applicable.
    notes – explanation, e.g. “250 calls/day (FMP free)”.
   o per_month:
    max_calls
    reset_day – if known, e.g. 21 for some providers.
   o per_minute / per_second:
    max_calls
    usually from “X requests per minute” limits.
   • credits_model – how they bill usage:
   o type:
    "per_request" – 1 credit per request.
    "per_symbol" – 1 credit per symbol in a batch.
   o default_credits_per_request: number (often 1).
   o notes – any provider-specific quirks.
   • kinds_supported – array of kinds supported by this provider, e.g.:
   o "fx", "commodities", "crypto", "equities", "weather", "holidays", "time".
   • status – "active" | "paused" (for Promagen usage).

---

2.2 api.endpoints.catalog.json – what we call
One row per logical endpoint per provider.
Purpose
• Enumerates all endpoints the worker might call.
• Connects them to providers, roles, paths, and costs.
Required fields (per endpoint)
• id
o Pattern: <provider_id>.<domain-purpose>
Examples:
 "twelvedata.fx-exchange_rate"
 "twelvedata.fx-currency_conversion"
 "twelvedata.crypto-cryptocurrencies"
 "twelvedata.crypto-cryptocurrency_exchanges"
 "twelvedata.equities-exchanges"
• provider_id
o Foreign key into api.providers.catalog.json.
• kind – enum (asset class):
o "fx"
o "commodities"
o "crypto"
o "equities"
o "time"
o "holidays"
o "weather"
• role – enum (Promagen job), see full list in section 3.
• description – short human sentence explaining the purpose.
• path – REST path, beginning with /, no base URL, e.g.:
o "/exchange_rate"
o "/currency_conversion"
o "/cryptocurrencies"
o "/cryptocurrency_exchanges"
o "/exchanges"
• method – "GET" or "POST".
• query_template – JSON object used as a template for the query string or body.
o Supports placeholders like "{{symbol}}", "{{symbols}}", "{{amount}}".
o Examples:
 FX exchange rate:
 {
 "symbol": "{{base}}/{{quote}}",
 "format": "JSON"
 }
 Currency conversion:
 {
 "symbol": "{{base}}/{{quote}}",
 "amount": "{{amount}}",
 "format": "JSON"
 }
• default_update – how the worker should treat this endpoint by default:
o cadence – string representing max cache age / schedule:
 "30s", "60s", "5m", "15m", "1h", "1d", "7d", "30d", or "ad-hoc" for on-demand only.
o only_when_open – boolean:
 true if bound to exchange hours (e.g. market state).
 false if always safe (FX, crypto, weather, catalogues).
o jitter_seconds – integer, e.g. 0, 10, 30, 60:
 used to avoid all workers hitting at exactly the same second.
• quota_cost – numeric
o Cost per logical call in provider credits.
o Usually 1, but may be higher if the provider bills differently.
• status – "active" | "paused" | "candidate"
o "active" – in use in production.
o "paused" – config kept, worker should not call it.
o "candidate" – experimental / not wired yet.
Optional fields
• quota_block_id – string
o Groups endpoints under a logical quota bucket for that provider:
 e.g. "twelvedata.basic-b.fx-ribbon",
 "twelvedata.basic-b.catalogs".
o The definition of each quota block lives in api.policies.json.
• tags – array of strings
o Useful labels like ["homepage", "belt"], ["catalogue"], ["paid-tier-only"].

---

2.3 api.policies.json – how often and who’s primary
This file owns cross-cutting rules, by role and by provider.
Purpose
• For each role, define:
o default cadence,
o primary provider,
o backup providers,
o safe call budgets per provider (hour/day),
o mapping to quota blocks.
• Define quota block details for each provider.
Structure (conceptual)
At a high level, two main sections:

1. roles – array of role policies:
   Each entry could include:
   o role – one of the role enums from section 3.
   o kind – "fx" | "commodities" | "crypto" | ....
   o default_cadence – the target cadence for this role (e.g. "60s" for fx-ribbon-realtime).
   o only_when_open – default for role, can be overridden per endpoint.
   o primary – object:
    provider_id
    endpoint_id (optional; if omitted, worker picks endpoint by role+provider).
   o backups – array of backup definitions (provider and optionally endpoint_id).
   o notes – free-text reasoning.
2. quota_blocks – array of quota blocks per provider:
   Each block describes how many calls are safe for a grouped set of endpoints.
   Fields:
   o provider_id
   o quota_block_id – matches endpoint.quota_block_id.
   o description
   o max_calls_per_day – raw provider/API docs figure.
   o max_calls_per_month – if applicable.
   o max_calls_per_minute – if rate-limited.
   o safety_factor – e.g. 0.7 (we only plan to use 70%).
   o safe_calls_per_day – derived.
   o safe_calls_per_hour – derived.
   o roles – array of role names that spend from this block.
   Derived values
   From provider quotas and safety factor:
   • Monthly → daily:
   o max_per_day_from_month = floor(max_per_month / 31)
   • Daily safety:
   o safe_per_day = floor(max_per_day _ safety_factor)
   • Hourly:
   o safe_per_hour_from_day = floor(safe_per_day / 24)
   o safe_per_hour_from_rpm = floor(rate_limit_rpm _ 60 \* safety_factor)
   • Final:
   o safe_calls_per_hour = min(safe_per_hour_from_day, safe_per_hour_from_rpm).
   For endpoints with quota_cost > 1:
   • safe_endpoint_calls_per_hour = floor(safe_calls_per_hour / quota_cost).
   These calculations don’t need to be stored in detail in JSON, but tests should recompute them to ensure the numbers in policies are consistent.

---

2.4 Optional: api.roles.catalog.json – what roles exist
Not mandatory, but a nice optional file:
• A simple list of roles with:
o role
o kind
o description
o typical_cadence
o live_vs_background flag.
Tests would then assert:
• Every endpoint.role appears in api.roles.catalog.json.
• Every role has at least one endpoint and at least one provider that supports it.

---

3. Roles – the jobs Promagen needs
   This section is crucial: it’s the canonical list of roles that endpoints and policies use.
   Each role has:
   • role – ID string in code/config.
   • kind – one of the asset classes.
   • live – whether it’s live/high cadence or background.
   3.1 FX roles
1. fx-ribbon-realtime
   o kind: fx
   o live: true
   o Live FX spot rates for the 5 homepage ribbon pairs.
1. fx-mini-widget
   o kind: fx
   o live: true
   o Same type of rate as ribbon, but used in the studio mini widget.
   o Can share endpoint + cadence with fx-ribbon-realtime initially.
1. fx-reference-daily
   o kind: fx
   o live: false
   o A slow “official” reference rate (e.g. daily ECB-like snapshot) used for normalisation and non-urgent conversions.
1. fx-conversion
   o kind: fx
   o live: on-demand
   o Converts a specific amount from one currency into another.
   o Backed by endpoints like Twelve Data /currency_conversion.
1. fx-pairs-catalog
   o kind: fx
   o live: background
   o Full list of supported currency pairs, used for validation and selection UIs.

---

3.2 Commodities roles 6. commodities-ribbon-realtime
o kind: commodities
o live: true
o Live prices for the 7-symbol commodities row (2-3-2 layout). 7. commodities-mini-widget
o kind: commodities
o live: true
o Commodities data for the mini widgets in the studio. 8. commodities-reference-daily
o kind: commodities
o live: background
o Daily snapshot for charts and non-urgent views. 9. commodities-asset-catalog
o kind: commodities
o live: background
o Full list of commodity instruments with categories (energy, metals, softs, etc.).

---

3.3 Crypto roles 10. crypto-ribbon-realtime
o kind: crypto
o live: true
o Live prices for the 5 crypto symbols on the ribbon. 11. crypto-mini-widget
o kind: crypto
o live: true
o Crypto data for paid-tier mini widgets and user-selected lists. 12. crypto-backfill
o kind: crypto
o live: background
o Short history window used for charts (e.g. last 7 days). 13. crypto-asset-catalog
o kind: crypto
o live: background
o Full universe of crypto pairs.
o For Twelve Data this is /cryptocurrencies.

---

3.4 Exchanges, equities, calendars, time 14. exchanges-stock-catalog
o kind: equities
o live: background
o List of stock exchanges (code, name, country, timezone).
o For Twelve Data this is /exchanges. 15. exchanges-crypto-catalog
o kind: crypto
o live: background
o List of crypto exchanges (name only in Twelve Data).
o For Twelve Data this is /cryptocurrency_exchanges. 16. equities-market-state
o kind: equities
o live: true
o “Is the exchange open, and time until next open/close?”
o Drives open/closed flags and countdowns on rails and belt. 17. equities-calendar
o kind: equities
o live: background
o Upcoming sessions and holidays for each exchange.
o Can be updated daily/weekly. 18. holidays-market-calendar
o kind: holidays
o live: background
o Generic holiday/futures calendar data if sourced outside equity APIs. 19. time-world-clock
o kind: time
o live: true or on-demand
o If using an external time API instead of pure local timezone logic.

---

3.5 Weather roles 20. weather-home
o kind: weather
o live: true but slow (e.g. 30–60 minutes).
o Current weather for each exchange city shown on homepage. 21. weather-backfill
o kind: weather
o live: background
o Optional; used if you later want weather trends.

---

3.6 Meta catalogue roles 22. meta-countries-catalog
o kind: treat as time or a special meta kind (your choice).
o Provides mapping of ISO country codes, names, capitals, and currencies.
o For Twelve Data this is /countries. 23. meta-currencies-catalog
o Possibly separate list of currencies if not implicit in fx-pairs-catalog.

---

4. Providers – current set
   These are the six providers you’ve already created accounts for.
   Each will have one api.providers.catalog.json entry.
   4.1 Twelve Data
   • id: twelvedata
   • Main use:
   o Primary FX provider.
   o Primary crypto provider.
   o Primary equities/exchanges provider.
   o Primary commodities provider.
   • Known endpoints (we’ve looked at docs for these):
   o /exchange_rate – FX & crypto spot rate.
   o /currency_conversion – FX/crypto conversion for a given amount.
   o /cryptocurrencies – crypto pairs catalogue.
   o /cryptocurrency_exchanges – crypto exchanges catalogue.
   o /exchanges – stock exchanges catalogue.
   o /commodities – commodities catalogue (symbol, category, etc.).
   o /market_state – exchange open/close info.
   o /exchange_schedule – detailed schedule (holidays, sessions).
   o /countries – country metadata.
   • Plan:
   o e.g. “Basic B” with a daily credit quota and minute-rate cap.
   • Data types:
   o fx, crypto, equities, commodities, some holidays/time via schedules.
   4.2 ExchangeRate-API
   • id: exchangerateapi
   • Main use:
   o Backup FX provider.
   o Slow reference rates for sanity checks.
   • Typical endpoints:
   o /<version>/<api_key>/latest/<base> – latest FX rates from a base currency.
   • Plan:
   o Free tier with approximately 1,500 calls/month (confirm from dashboard when you fill in the provider JSON).
   • Data:
   o fx.
   4.3 ExchangeRate.host
   • id: exchangeratehost
   • Main use:
   o Backup FX provider.
   o Possibly for fx-reference-daily.
   • Typical endpoints:
   o /latest, /timeseries, /convert, etc.
   • Plan:
   o Free tier with some monthly call allowance (fill exact numbers from your dashboard).
   • Data:
   o fx.
   4.4 API Ninjas
   • id: apininjas
   • Main use:
   o Misc data (e.g. commodities, perhaps extra macro statistics), plus optional FX/Crypto backup if you want.
   • Plan:
   o Free tier with ~3,000 calls/month (as shown on profile; confirm exact number on fill-in).
   • Data:
   o fx, commodities, other (lots of small endpoints).
   4.5 Financial Modeling Prep (FMP)
   • id: fmp
   • Main use:
   o Equities fundamentals, some market data, alternative backup for equities kind data.
   • Plan:
   o Free tier with ~250 calls/day (from dashboard; confirm exact number).
   • Data:
   o equities (fundamentals, market data), some fx and crypto if you use them.
   4.6 Oil Price API
   • id: oilpriceapi
   • Main use:
   o Oil price benchmarks (e.g. Brent, WTI) for the commodities ribbon.
   • Plan:
   o Free-tier limit around 500 requests/month (dashboard shows 0/500; use that).
   • Data:
   o commodities (energy).

---

5. Mapping roles to endpoints (Twelve Data – confirmed so far)
   This is what we’ve actually pinned down in some detail.
   You’ll later add similar entries for other providers for the same roles.
   5.1 FX exchange rate – /exchange_rate
   • Endpoint ID: twelvedata.fx-exchange_rate
   • Provider: twelvedata
   • Kind: fx
   • Role: fx-ribbon-realtime (also used by fx-mini-widget initially).
   • Path: /exchange_rate
   • Method: GET
   • Query template (conceptual):
   o symbol: "{{base}}/{{quote}}"
   o format: "JSON"
   o Optional: date, dp, timezone if you choose to expose them.
   • Default update:
   o cadence: "60s"
   o only_when_open: false (FX/crypto)
   o jitter_seconds: 10
   • Quota:
   o quota_cost: 1
   o quota_block_id: e.g. "twelvedata.basic-b.fx-ribbon"
   • Status: active.

---

5.2 FX conversion – /currency_conversion
• Endpoint ID: twelvedata.fx-currency_conversion
• Provider: twelvedata
• Kind: fx
• Role: fx-conversion
• Path: /currency_conversion
• Method: GET (you might later add POST bulk).
• Query template:
o symbol: "{{base}}/{{quote}}"
o amount: "{{amount}}"
o format: "JSON"
• Default update:
o cadence: "ad-hoc" (on-demand; used when user presses “convert”).
o only_when_open: false
o jitter_seconds: 0
• Quota:
o quota_cost: 1
o quota_block_id: e.g. "twelvedata.basic-b.fx-utilities"
• Status: active once wired; candidate until you actually use it.

---

5.3 Crypto pairs catalogue – /cryptocurrencies
• Endpoint ID: twelvedata.crypto-cryptocurrencies
• Provider: twelvedata
• Kind: crypto
• Role: crypto-asset-catalog
• Path: /cryptocurrencies
• Method: GET
• Query template:
o format: "JSON"
• Default update:
o cadence: "1d" (the universe is fairly stable).
o only_when_open: false
o jitter_seconds: 300
• Quota:
o quota_cost: 1
o quota_block_id: "twelvedata.basic-b.catalogs"
• Status: active.
• Data shape (from CSV/PDF you captured):
o symbol – e.g. "BTC/USD", "ETH/USDT".
o available_exchanges – array of exchange names.
o currency_base – e.g. "Bitcoin".
o currency_quote – e.g. "US Dollar".
The raw output of this endpoint populates your src/data/crypto master catalogue.

---

5.4 Crypto exchanges catalogue – /cryptocurrency_exchanges
• Endpoint ID: twelvedata.crypto-cryptocurrency_exchanges
• Provider: twelvedata
• Kind: crypto
• Role: exchanges-crypto-catalog
• Path: /cryptocurrency_exchanges
• Method: GET
• Query template:
o format: "JSON"
• Default update:
o cadence: "7d" (weekly refresh is enough).
o only_when_open: false
o jitter_seconds: 600
• Quota:
o quota_cost: 1
o quota_block_id: "twelvedata.basic-b.catalogs"
• Status: active.
• Data shape (from your CSV):
o field exchange, one per row, giving the exchange name.

---

5.5 Stock exchanges catalogue – /exchanges
• Endpoint ID: twelvedata.equities-exchanges
• Provider: twelvedata
• Kind: equities
• Role: exchanges-stock-catalog
• Path: /exchanges
• Method: GET
• Query template:
o format: "JSON"
• Default update:
o cadence: "30d" (monthly; list changes very rarely).
o only_when_open: false
o jitter_seconds: 3600
• Quota:
o quota_cost: 1
o quota_block_id: "twelvedata.basic-b.catalogs"
• Status: active.
• Data shape (from CSV):
Typical columns:
o title – e.g. "Australia Stock Exchange".
o name – shorter display name.
o code – MIC code (e.g. XASX).
o country – country name.
o timezone – IANA timezone.
These feed your src/data/exchanges master catalogue and exchange rails configuration.

---

5.6 Other Twelve Data endpoints (not yet fully designed but known)
These are recognised but not fully wired:
• /commodities
→ candidate for commodities-asset-catalog and possibly commodities-reference-daily.
• /market_state
→ candidate for equities-market-state (open/closed per exchange).
• /exchange_schedule
→ candidate for equities-calendar.
• /countries
→ candidate for meta-countries-catalog.
For these, you’ll:
• Later add specific endpoint entries with id, role, default_update, etc.
• Derive their data shapes from the docs you’ve already looked at.

---

6. Things that need API data – by role
   This is the exhaustive list of “jobs” that need external data, mapped back to roles.
   6.1 Live / frequent data
   These are typically polled or cached with short cadences.
   • Homepage FX ribbon (5 pairs) → fx-ribbon-realtime
   • FX mini widget (studio) → fx-mini-widget
   • Homepage commodities row (7 symbols) → commodities-ribbon-realtime
   • Commodities mini widget → commodities-mini-widget
   • Homepage crypto row (5 symbols) → crypto-ribbon-realtime
   • Crypto mini widget → crypto-mini-widget
   • Market open/close state for each stock exchange → equities-market-state
   • Homepage weather per exchange city → weather-home
   • On-demand currency conversion → fx-conversion
   • Optionally: world clock/time API → time-world-clock
   6.2 Background / slow data
   Pulled less frequently and cached heavily.
   • Stock exchanges universe → exchanges-stock-catalog
   • Crypto exchanges universe → exchanges-crypto-catalog
   • Crypto pairs universe → crypto-asset-catalog
   • FX pairs universe → fx-pairs-catalog
   • Commodities universe → commodities-asset-catalog
   • Countries/currency meta → meta-countries-catalog (and optionally meta-currencies-catalog)
   • Market calendars/holidays → equities-calendar and/or holidays-market-calendar
   • FX daily reference rates → fx-reference-daily
   • Commodities daily reference → commodities-reference-daily
   • Crypto backfill for charts → crypto-backfill
   • Weather backfill (if used) → weather-backfill
   Every one of these has/will have a mapping to:
   • a primary provider + backup providers in api.policies.json,
   • one or more endpoint entries in api.endpoints.catalog.json.

---

7. Quota & safety model
   7.1 Normalising provider quotas
   Providers express limits in different ways:
   • per month – e.g. 500 calls/month.
   • per day – e.g. 250 calls/day.
   • per minute – e.g. 8 calls/minute.
   • credits per day – e.g. 800 credits/day, where each request costs 1 credit.
   We normalise as:
1. Monthly to daily:
   o max_per_day_from_month = floor(max_per_month / 31)
1. Pick the more restrictive of “stated daily” and “from monthly” if both exist.
1. Apply safety factor s (e.g. 0.7):
   o safe_per_day = floor(max_per_day \* s)
1. Use rate limit:
   o max_per_hour_by_rpm = rpm _ 60
   o safe_per_hour_from_rpm = floor(max_per_hour_by_rpm _ s)
1. Final safe per hour:
   o safe_calls_per_hour = min(safe_per_day / 24, safe_per_hour_from_rpm)
1. For endpoints with quota_cost > 1:
   o safe_endpoint_calls_per_hour = floor(safe_calls_per_hour / quota_cost).
   These calculations will be re-computed by tests to verify the values in api.policies.json.
   7.2 Quota blocks
   Each provider can define quota blocks in api.policies.json, e.g.:
   • twelvedata.basic-b.fx-ribbon
   • twelvedata.basic-b.fx-utilities
   • twelvedata.basic-b.catalogs
   Each block defines:
   • which roles draw from it;
   • safe_calls_per_day/hour for that block.
   Each endpoint can optionally reference a quota_block_id.
   The worker logic will:
   • ensure total planned calls for the block never exceed safe_calls_per_hour (with some buffer).

---

8. Tests & safety nets
   The aim: any mistake in providers/endpoint/policy JSON should cause tests to fail loudly.
   8.1 Shape tests
   • api.providers.catalog.shape.test.ts
   o Every provider has all required fields and correct types.
   • api.endpoints.catalog.shape.test.ts
   o Every endpoint has all required fields.
   o id values are unique.
   • api.policies.shape.test.ts
   o Policies and quota blocks follow the expected schema.
   8.2 Foreign key tests
   • endpoint.provider_id must exist in providers catalogue.
   • If endpoint.quota_block_id is set, that quota_block_id must exist in policies.
   • If you add api.roles.catalog.json, every endpoint.role must exist there.
   8.3 Enum and value tests
   • endpoint.kind in allowed {fx, commodities, crypto, equities, time, holidays, weather}.
   • endpoint.method in {GET, POST}.
   • endpoint.status in {active, paused, candidate}.
   • endpoint.default_update.cadence is one of the approved cadence strings.
   • endpoint.role in the canonical role list from section 3.
   8.4 Quota sanity tests
   For each provider and quota block:
1. Reconstruct safe per day/hour from raw quotas and safety factor.
1. Compute planned calls from all endpoints that use that block, given:
   o number of assets per role (e.g. 5 FX pairs, 7 commodities symbols).
   o cadence from role or endpoint default_update.
   Assert:
   • total_planned_calls_per_day ≤ safe_per_day.
   • total_planned_calls_per_hour ≤ safe_calls_per_hour.
   8.5 Simulated month tests (nice extra)
   • For 1–2 providers (e.g. Twelve Data and FMP), simulate a full 31-day month.
   • Pretend the worker runs on schedule and track simulated calls per block.
   • Assert that at no point do we exceed the provider’s nominal quotas.
   8.6 CI report
   Add a script (later) like pnpm api:config-report that:
   • Reads providers, endpoints, and policies.
   • Outputs a summary JSON to reports/api-config-<timestamp>.json, including:
   o provider list,
   o endpoints per role,
   o primary/backup assignments,
   o quota blocks and safe budgets.
   In CI:
   • Run this script on every build.
   • Upload the report file as an artefact so you have a history of API config changes.

---

9. Decision guide – “where does this fact go?”
   So you never have to think about this again:
   • If you discover something about the provider account:
   o plan name, free tier limit, base URL, dashboards, pricing quirks →
   api.providers.catalog.json
   • If you define a logical endpoint:
   o path, method, query parameters, which role it serves, quota_cost, cadence, status →
   api.endpoints.catalog.json
   • If you decide how often to call, or which provider is primary, or safe budgets:
   o per role, per provider, primary/backups, quota blocks →
   api.policies.json
   • If you have raw market universe data (exchanges, crypto pairs, etc.):
   o The data itself (rows and symbols) →
   appropriate catalogue under src/data/exchanges, src/data/crypto, src/data/commodities, etc.
   o The endpoint that fetched it →
   api.endpoints.catalog.json.
10. Health, lag rule, flags and demo mode
    Promagen shouldn’t just know what to call – it must also know how healthy the data feed is and surface that to the user in a simple way.
    We use two layers:
    • A technical health state per provider+role (up, lagging, down, demo).
    • A UI flag indicator per role on the homepage/studio (2 flags, 1 flag, none).
    10.1 Per-provider health state
    For each (role, provider_id, endpoint_id) we track:
    • last_success_at – timestamp of last successful response.
    • last_failure_at – timestamp of last failed attempt (if any).
    • consecutive_failures – integer.
    We also know from config:
    • expected_cadence_seconds – derived from endpoint.default_update.cadence
    (e.g. "60s" → 60, "5m" → 300, "1d" → 86400).
    For "ad-hoc" roles we treat them differently (see below).
    We define a staleness ratio:
    staleness_ratio = (now - last_success_at) / expected_cadence_seconds
    Status rules (for scheduled roles)
    For roles with a scheduled cadence (not "ad-hoc"):
    • UP (healthy)
    o consecutive_failures == 0 and
    o staleness_ratio <= 1.5
    (data is no more than 1.5× the expected cadence old).
    • LAGGING (degraded)
    o staleness_ratio > 1.5 and staleness_ratio <= 3
    or
    o consecutive_failures > 0 but < N_failures_to_down
    (e.g. N = 3 attempts).
    • DOWN
    o staleness_ratio > 3
    or
    o consecutive_failures >= N_failures_to_down.
    These thresholds (1.5× and 3×) are defaults. They should be defined centrally so we can tune them (for example, some roles might tolerate older data).
    For catalogue roles (daily/weekly/monthly), we use the same formula but the expected cadence is much larger (e.g. one day). “LAGGING” there usually means a batch job hasn’t run yet, not a user-visible incident.
    Status rules (for ad-hoc roles)
    For roles like fx-conversion where calls only happen when a user asks:
    • We don’t use cadence. Instead, we base health on recent success/failure:
    o UP: last call for that role+provider succeeded, and no recent errors.
    o DOWN: last N attempts (e.g. 3) for that provider failed (network, 5xx, 4xx, etc.).
    o LAGGING: can be treated same as DOWN for UI purposes, or we can use a “slow response time” threshold if we measure latency.
    In practice, a conversion API being down just means we must fall back to a secondary provider or show an error.
    DEMO state
    Separately from health, a provider can be in DEMO state for a role, meaning:
    • We don’t have a real API key configured, or
    • Promagen is explicitly running that provider in demo mode (docs/examples only).
    In this state:
    • The worker should never make real calls.
    • The UI should treat data as sample / non-live.

---

10.2 Flag system (2 flags / 1 flag / none / demo)
For each role (e.g. fx-ribbon-realtime, crypto-ribbon-realtime), we’ll have in api.policies.json:
• primary – main provider.
• backups – list of backup providers in priority order.
From health states of those providers, we derive a simple flag indicator:
• Two flags – “All good, full redundancy”
o At least two providers for this role are UP.
o Example: Twelve Data and ExchangeRate-API both healthy for fx-ribbon-realtime.
• One flag – “Degraded: redundancy lost”
o Exactly one provider is UP; at least one other is DOWN or LAGGING.
o The role is still serving live data, but if that one provider fails, we’ll drop to demo/frozen.
• No flags – “No live providers”
o Zero providers are UP for this role.
o Behaviour:
 Use last known_cached data if available, mark as stale, or
 Switch to demo data, depending on role configuration.
o For the UI, we treat this as “no live API” for that role.
• DEMO badge – “Demo mode, no real API”
o All providers for the role are in DEMO state (no real keys), or
o The role is explicitly marked demo-only in policies.
o The underlying data is static/sample; all calls are local, no external API.
In short, user-facing meanings:
• 2 flags → All APIs for this role are healthy.
• 1 flag → At least one API for this role is down/lagging; we’re running on a single live provider.
• 0 flags → No live provider; the view is using stale or fallback data.
• DEMO → No real API hooked up; view is purely demo/sample.

---

10.3 Where this lives in JSON / code
• In api.policies.json per role:
o primary / backups – as before.
o Optional demo_mode flag if a role is intentionally demo-only for now.
o Optional min_live_providers_for_two_flags (default 2) – if you ever want more redundancy before showing two flags.
• In the worker / service layer (code):
o Keep an in-memory (or persisted) health map:
{ [role]: { [provider_id]: { status: "up" | "lagging" | "down" | "demo", last_success_at, last_failure_at, consecutive_failures } } }.
o Recompute status after every call based on the lag rules from 10.1.
o For each role, derive the UI flags from the health map and the primary/backups list. 11. Universal resilience tiers and icons/emoji
The “flag rule” is a universal resilience indicator used across Promagen.
It works the same way for any feature that has multiple API providers behind it; only the visual skin (flags vs emoji vs other icons) changes per feature.
11.1 Internal resilience levels
For each role (e.g. fx-ribbon-realtime, crypto-ribbon-realtime, weather-home) we may configure up to three real providers:
• 1 × primary
• 2 × backups
For that role, we track the health of each provider:
• up
• lagging
• down
• demo
To compute a simple resilience level, we define:
• N_live = number of providers whose status is up for that role
(by default, lagging does not count as “live” here).
Then:
• Level 3 – full redundancy
o N_live == 3
• Level 2 – degraded but safe
o N_live == 2
• Level 1 – thin ice
o N_live == 1
• Level 0 – no live API
o N_live == 0 (only cached/demo data available)
The worker/service layer should expose this as a first-class value, e.g.:
{
role: "fx-ribbon-realtime",
resilience_level: 0 | 1 | 2 | 3,
provider_statuses: {
twelvedata: "up" | "lagging" | "down" | "demo",
exchangerateapi: "...",
exchangeratehost: "..."
}
}
Front-end code should not re-compute counts; it simply reads resilience_level.
11.2 Mapping resilience levels to flags / emoji / icons
Each feature chooses its own visual representation (flags, dots, emoji, etc.),
but all features must follow the same mapping:
• Level 3 (N_live = 3) – “two icons”
o Show two positive icons (e.g. two flags, or two green dots).
o Meaning: all three providers for this role are healthy; maximum resilience.
• Level 2 (N_live = 2) – “one icon”
o Show one positive icon.
o Meaning: one provider is unavailable or lagging; there is still redundancy, but it’s reduced.
• Level 1 (N_live = 1) – “no icon”
o Show no icon (just the data, optionally with a subtle tooltip).
o Meaning: only a single provider is still healthy; if it fails, the role will fall back to cache/demo.
• Level 0 (N_live = 0) – DEMO / emergency
o Show a clear “DEMO” or “OFFLINE” badge for that feature.
o Meaning: no live providers. Data is either:
 frozen from cache and explicitly marked stale, or
 replaced with static demo/sample content.
In other words:
• Two icons → three providers up (full resilience)
• One icon → two providers up (reduced resilience)
• No icon → one provider up (thin ice)
• DEMO badge → zero providers up (emergency / demo fallback)
This rule is universal and should be reused for:
• All API-heavy finance features (ribbons, mini widgets, calendars, etc.)
• Any future AI/provider features (LLM primary + backups)
• Any other subsystem that has 3→2→1→0 provider redundancy, even if the UI doesn’t literally use flags.
