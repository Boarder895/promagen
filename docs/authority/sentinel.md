# sentinel.md — Promagen Sentinel: AI Visibility Intelligence System

**Last updated:** 9 April 2026
**Version:** 2.0.0
**Status:** Phase 1 BUILD COMPLETE. 24 modules + 3 API routes + 1 dashboard + 30 tests. Phase 2 infrastructure ready.
**Scope:** Automated site monitoring, AI citation tracking, regression detection, and weekly intelligence reporting
**Owner:** Promagen Ltd
**Authority:** This document defines the full Sentinel system. No monitoring behaviour may be invented outside of what is documented here.

---

## 1. What Sentinel Is

Sentinel is Promagen's self-monitoring intelligence layer. It crawls Promagen's own public pages on a schedule, detects regressions, measures AI visibility, and delivers a prioritised action report every Monday morning.

Sentinel is not an SEO tool. SEO tools tell you what's broken. Sentinel tells you what to do next and why — combining technical health, AI crawler activity, GA4 referral data, and content freshness into a single decision-ready report.

### 1.1 Why This Exists

Promagen's authority pages (/platforms, 40 profiles, guides, methodology) are specifically designed to be cited by AI systems. The investment in those pages only pays off if:

1. The pages stay technically healthy (no regressions after deploys)
2. AI crawlers are actually visiting them
3. AI platforms are citing them in responses
4. Users arriving from AI platforms are converting

Sentinel closes all four measurement loops automatically. The only manual step remaining is the weekly citation test — pasting queries into AI platforms and recording whether Promagen is mentioned.

### 1.2 Design Principles

- **Self-contained:** Runs on existing Promagen infrastructure (Vercel crons, Postgres, existing analytics). No external paid tools.
- **Incremental:** Built in phases. Each phase delivers value before the next begins. Nothing is speculative.
- **Evidence-first:** Every recommendation in the report is backed by data from the crawl, not opinion.
- **Non-invasive:** Sentinel reads Promagen's own pages as a public visitor. It does not modify any page, database, or config. It is a read-only observer.
- **Cost-conscious:** The entire system runs within existing Vercel Pro plan limits. The only marginal cost is the Claude API analysis call (~$0.02–0.05 per weekly run if the Analyst layer is enabled).
- **Degrades cleanly:** If any external dependency fails (GA4, Anthropic API, Resend), the system persists whatever partial data it collected and notes the failure in the report. It never silently drops data.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SENTINEL SYSTEM                                │
│                                                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Phase 1      │   │  Phase 2      │   │  Phase 3              │ │
│  │  WATCHKEEPER  │──▶│  INTELLIGENCE │──▶│  ANALYST              │ │
│  │  (Self-Crawl) │   │  (GA4 + Logs) │   │  (Claude AI Review)   │ │
│  └──────────────┘   └──────────────┘   └──────────────────────┘ │
│         │                   │                     │               │
│         ▼                   ▼                     ▼               │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              POSTGRES: sentinel_runs                          ││
│  │              sentinel_snapshots                               ││
│  │              sentinel_regressions                             ││
│  │              sentinel_suppressions                            ││
│  │              sentinel_link_graph                              ││
│  │              sentinel_crawler_visits                          ││
│  └──────────────────────────────────────────────────────────────┘│
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              MONDAY REPORT (email via Resend)                ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  MANUAL LAYER: Citation Cockpit (interactive scorecard)      ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Three Phases (Built Sequentially)

| Phase | Name         | What It Does                                                                                            | Depends On                         |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1     | Watchkeeper  | Self-crawl + snapshot + regression detection + link graph + tripwires + email report                    | Postgres, Vercel cron              |
| 2     | Intelligence | Consumes existing GA4 data (ai_citation_landing events, AI referral sessions) + AI crawler log analysis | Phase 1 + GA4 Data API credentials |
| 3     | Analyst      | Sends crawl data + GA4 data to Claude API for prioritised AI-written analysis                           | Phase 2 + Anthropic API key        |

Each phase is independently useful. Phase 1 alone catches 80% of problems.

**Phase order rationale (v1.1.0 correction):** The mechanical crawl layer must be battle-tested before AI analysis is added. GA4 integration moves to Phase 2 (earlier than v1.0.0) because the existing analytics plumbing (ai_citation_landing hook, provider_activity_events, conversion authority chain) is already wired and producing data — Sentinel should consume it early, not rebuild it late. The Claude Analyst moves to Phase 3 (last) so it operates on trusted signals, not raw untested data.

---

## 3. Phase 1 — Watchkeeper (Self-Crawl Engine)

### 3.1 How It Works

A Vercel cron job runs every Monday at 06:00 UTC. It fetches every public URL from Promagen's own sitemap (which is already dynamically generated from the SSOT). For each page, it extracts:

| Data Point            | How Extracted                                                         | Why It Matters                                  |
| --------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| HTTP status code      | Response status                                                       | Catches 404s, 500s, redirects                   |
| Title tag             | Parse `<title>`                                                       | Detects missing or changed titles               |
| Meta description      | Parse `<meta name="description">`                                     | Detects missing descriptions (current #1 issue) |
| H1                    | Parse first `<h1>`                                                    | Catches empty or duplicate H1s                  |
| Canonical tag         | Parse `<link rel="canonical">`                                        | Detects missing canonicals (current #2 issue)   |
| Word count            | Strip HTML, count words                                               | Detects thin pages or content loss              |
| JSON-LD schema types  | Parse `<script type="application/ld+json">`                           | Catches schema disappearing after deploy        |
| Internal link count   | Count `<a href>` pointing to promagen.com                             | Measures link equity distribution               |
| Internal link targets | Extract all internal href values                                      | Builds the link graph                           |
| SSOT version          | Parse the "Data derived from platform-config.json (SSOT vX.X.X)" text | Detects stale data (freshness watchdog)         |
| "Last verified" date  | Parse the date stamp on authority profiles                            | Detects stale verification claims               |
| FAQ count             | Count FAQ schema entries                                              | Tracks FAQ coverage                             |
| Response time (ms)    | Measure fetch duration                                                | Catches performance regressions                 |

### 3.2 Run Lifecycle (v1.1.0 addition)

Every cron execution creates a run record. This is essential for debugging partial failures and proving the system ran successfully.

```sql
CREATE TABLE sentinel_runs (
  id            BIGSERIAL PRIMARY KEY,
  run_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'started',
    -- Lifecycle: started → crawl_complete → diff_complete → reported → failed
  pages_crawled INT DEFAULT 0,
  pages_total   INT DEFAULT 0,
  regressions_found INT DEFAULT 0,
  suppressions_applied INT DEFAULT 0,
  crawl_duration_ms INT,
  diff_duration_ms INT,
  report_sent   BOOLEAN DEFAULT FALSE,
  failure_reason TEXT,                     -- Null unless status = 'failed'
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);
```

**Run state transitions:**

```
started
  │
  ├─► crawl_complete  (all pages fetched, snapshots written)
  │     │
  │     ├─► diff_complete  (regressions computed, suppressions applied)
  │     │     │
  │     │     ├─► reported  (email sent successfully)
  │     │     │
  │     │     └─► failed  (email send failed — data still persisted)
  │     │
  │     └─► failed  (diff computation failed — snapshots still persisted)
  │
  └─► failed  (crawl failed — partial snapshots may exist)
```

**Rule:** The cron always persists whatever data it collected before failure. A failed run with 40/57 pages crawled is better than no data at all. The Monday report notes "Crawl incomplete: 40/57 pages" rather than hiding the failure.

### 3.2.1 Idempotency & Duplicate Run Rules (v1.2.0 addition)

Vercel may retry a cron if the initial invocation times out. Manual triggers are also possible. Without idempotency rules, duplicate runs produce duplicate reports and messy history.

**Hard rules:**

- **One primary weekly run per `run_date`.** The first successful run for a given Monday is the primary run.
- **Duplicate detection:** On entry, the cron checks `sentinel_runs` for an existing row with the same `run_date`. If a completed run exists (`status = reported`), the cron returns `200 { skipped: true, reason: 'primary_run_exists' }` and does nothing.
- **Rerun handling:** If a run exists but its status is `failed`, a new run is permitted and marked `is_rerun = TRUE`. The rerun supersedes the failed run for reporting purposes.
- **Concurrent protection:** The cron acquires a Postgres advisory lock (same pattern as the existing `promagen-users` cron) before starting. If the lock is held, the cron returns immediately.
- **Tripwire runs are separate:** Daily tripwire runs (Tue–Sun) never write to `sentinel_snapshots` and never conflict with the Monday full crawl. They have their own `run_type = 'tripwire'` in `sentinel_runs`.

Updated `sentinel_runs` schema:

```sql
CREATE TABLE sentinel_runs (
  id            BIGSERIAL PRIMARY KEY,
  run_date      DATE NOT NULL,
  run_type      TEXT NOT NULL DEFAULT 'weekly',  -- 'weekly' | 'tripwire' | 'manual'
  is_rerun      BOOLEAN DEFAULT FALSE,
  status        TEXT NOT NULL DEFAULT 'started',
  pages_crawled INT DEFAULT 0,
  pages_total   INT DEFAULT 0,
  regressions_found INT DEFAULT 0,
  suppressions_applied INT DEFAULT 0,
  crawl_duration_ms INT,
  diff_duration_ms INT,
  report_sent   BOOLEAN DEFAULT FALSE,
  failure_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_sentinel_primary_run
  ON sentinel_runs(run_date, run_type)
  WHERE is_rerun = FALSE AND status = 'reported';
```

The unique partial index guarantees at most one successful primary run per date per type.

### 3.3 Snapshot Storage

Each weekly crawl produces one row per URL in the `sentinel_snapshots` table:

```sql
CREATE TABLE sentinel_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  run_id        BIGINT REFERENCES sentinel_runs(id),
  crawl_date    DATE NOT NULL,
  url           TEXT NOT NULL,
  page_class    TEXT NOT NULL,              -- hub, profile, guide, comparison, use_case, product, homepage
  status_code   INT NOT NULL,
  title         TEXT,
  meta_desc     TEXT,
  h1            TEXT,
  canonical     TEXT,
  word_count    INT,
  schema_types  TEXT[],                    -- e.g. ['ItemList', 'FAQPage']
  internal_links_out INT,
  internal_links_in  INT,                  -- computed after full crawl
  ssot_version  TEXT,
  last_verified TEXT,
  faq_count     INT,
  response_ms   INT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sentinel_url_date ON sentinel_snapshots(url, crawl_date);
CREATE INDEX idx_sentinel_run ON sentinel_snapshots(run_id);
```

**Page classes** (v1.1.0 addition): Every URL is classified into a page class. Different classes have different regression thresholds (a homepage H1 change is expected more often than a profile H1 change):

| Page Class  | URL Pattern                                | Example                                 |
| ----------- | ------------------------------------------ | --------------------------------------- |
| homepage    | `/`                                        | /                                       |
| hub         | `/platforms`                               | /platforms                              |
| profile     | `/platforms/[id]`                          | /platforms/midjourney                   |
| guide       | `/guides/*`, `/platforms/negative-prompts` | /guides/prompt-formats                  |
| comparison  | `/platforms/compare/*`                     | /platforms/compare/midjourney-vs-dalle  |
| use_case    | `/guides/best-generator-for/*`             | /guides/best-generator-for/photorealism |
| methodology | `/about/*`                                 | /about/how-we-score                     |
| product     | Everything else                            | /providers, /leaderboard, /inspire      |

### 3.4 Regression Detection

After the crawl completes, the cron compares this week's snapshot to last week's for every URL. A regression is any of:

| Regression Type   | Trigger                                          | Severity | Minimum History           |
| ----------------- | ------------------------------------------------ | -------- | ------------------------- |
| Page down         | Status code changed from 200 to 4xx/5xx          | CRITICAL | 1 week                    |
| Title lost        | Title was present, now empty or null             | HIGH     | 1 week                    |
| Meta desc lost    | Meta description was present, now empty          | HIGH     | 1 week                    |
| Schema lost       | Schema types array shrank (type disappeared)     | HIGH     | 1 week                    |
| H1 changed        | H1 text changed (profile/guide/hub pages only)   | MEDIUM   | 2 weeks                   |
| Content shrink    | Word count dropped by >20%                       | MEDIUM   | 3 weeks (baseline needed) |
| Canonical lost    | Canonical was present, now missing               | MEDIUM   | 1 week                    |
| Links dropped     | Internal link count dropped by >30%              | MEDIUM   | 3 weeks (baseline needed) |
| Performance spike | Response time increased by >3x vs 4-week average | LOW      | 4 weeks                   |
| SSOT drift        | SSOT version on page differs from current        | LOW      | 1 week                    |

**Minimum history (v1.1.0 addition):** Some regressions require a baseline before they trigger. Content shrink, link drops, and performance spikes need multiple weeks of stable data to avoid false alarms in the first weeks of operation.

**Class-specific regression thresholds (v1.2.0 addition):**

Not every page class uses the same rules. A homepage H1 change is normal. A platform profile H1 change is suspicious. These thresholds define the actual policy matrix:

| Regression Type       | homepage | hub      | profile  | guide    | comparison | use_case | methodology | product |
| --------------------- | -------- | -------- | -------- | -------- | ---------- | -------- | ----------- | ------- |
| Page down             | CRITICAL | CRITICAL | CRITICAL | CRITICAL | CRITICAL   | CRITICAL | CRITICAL    | HIGH    |
| Title lost            | HIGH     | HIGH     | HIGH     | HIGH     | HIGH       | HIGH     | HIGH        | MEDIUM  |
| Meta desc lost        | HIGH     | HIGH     | HIGH     | HIGH     | HIGH       | HIGH     | HIGH        | LOW     |
| Schema lost           | MEDIUM   | HIGH     | HIGH     | HIGH     | HIGH       | HIGH     | HIGH        | LOW     |
| H1 changed            | IGNORED  | MEDIUM   | MEDIUM   | MEDIUM   | MEDIUM     | MEDIUM   | MEDIUM      | IGNORED |
| Content shrink >20%   | IGNORED  | HIGH     | MEDIUM   | HIGH     | MEDIUM     | MEDIUM   | HIGH        | IGNORED |
| Content shrink >30%   | MEDIUM   | CRITICAL | HIGH     | CRITICAL | HIGH       | HIGH     | CRITICAL    | LOW     |
| Canonical lost        | MEDIUM   | HIGH     | HIGH     | HIGH     | HIGH       | HIGH     | HIGH        | MEDIUM  |
| Links dropped >30%    | LOW      | MEDIUM   | MEDIUM   | MEDIUM   | LOW        | LOW      | MEDIUM      | IGNORED |
| Performance spike >3x | LOW      | MEDIUM   | LOW      | LOW      | LOW        | LOW      | LOW         | IGNORED |
| SSOT drift            | IGNORED  | HIGH     | MEDIUM   | MEDIUM   | MEDIUM     | MEDIUM   | LOW         | IGNORED |

**Key policy decisions:**

- Homepage and product pages are deliberately relaxed — they change frequently by design
- Authority pages (hub, profile, guide, comparison, use_case, methodology) are strict — they are the citation-earning layer
- Methodology page has the tightest content shrink threshold — it must remain comprehensive for E-E-A-T
- Product pages are excluded from tripwire alerts entirely (§3.8)

Regressions are stored in `sentinel_regressions`:

```sql
CREATE TABLE sentinel_regressions (
  id            BIGSERIAL PRIMARY KEY,
  run_id        BIGINT REFERENCES sentinel_runs(id),
  crawl_date    DATE NOT NULL,
  url           TEXT NOT NULL,
  page_class    TEXT NOT NULL,
  regression_type TEXT NOT NULL,
  severity      TEXT NOT NULL,              -- CRITICAL, HIGH, MEDIUM, LOW
  previous_value TEXT,
  current_value  TEXT,
  resolved       BOOLEAN DEFAULT FALSE,
  resolved_date  DATE,
  suppressed     BOOLEAN DEFAULT FALSE,     -- v1.1.0
  suppression_id BIGINT,                    -- v1.1.0
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.5 Suppression Workflow (v1.1.0 addition)

Some regressions are intentional. If you deliberately change a page's H1, you don't want the report screaming about it for 12 weeks. Suppressions let you mute a known issue.

```sql
CREATE TABLE sentinel_suppressions (
  id            BIGSERIAL PRIMARY KEY,
  url           TEXT NOT NULL,
  regression_type TEXT NOT NULL,            -- or '*' for all types on this URL
  reason        TEXT NOT NULL,              -- "Intentional H1 change for SEO test"
  expires_at    DATE,                       -- Null = until manually removed
  created_by    TEXT DEFAULT 'manual',      -- 'manual' or 'auto'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Rules:**

- A suppressed regression still appears in the database but is excluded from the Monday report and does not count toward the regression total
- Expired suppressions automatically stop suppressing (the regression reappears in the next report)
- The Monday report includes a one-line summary: "3 regressions suppressed (2 intentional H1 changes, 1 expected content update)"
- Suppressions are managed manually via direct database queries initially; the /admin/sentinel dashboard (future) will provide a UI

**Suppression command reference (v1.2.0 addition):**

```sql
-- Suppress a specific regression type on one URL (expires in 30 days)
INSERT INTO sentinel_suppressions (url, regression_type, reason, expires_at)
VALUES ('/pro-promagen', 'h1_changed', 'Intentional redesign', NOW() + INTERVAL '30 days');

-- Suppress ALL regression types on one URL (temporary, e.g. during rebuild)
INSERT INTO sentinel_suppressions (url, regression_type, reason, expires_at)
VALUES ('/inspire', '*', 'Page being rebuilt this sprint', NOW() + INTERVAL '14 days');

-- View active suppressions
SELECT * FROM sentinel_suppressions
WHERE (expires_at IS NULL OR expires_at > NOW());

-- Remove a suppression manually
DELETE FROM sentinel_suppressions WHERE id = 3;

-- Clean up expired suppressions (run monthly or add to retention cron)
DELETE FROM sentinel_suppressions
WHERE expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '30 days';
```

### 3.6 Internal Link Graph Scoring

After crawling all pages, the system computes inbound link counts for every URL. This produces:

- **Link equity ranking** — which pages have the most internal links pointing to them
- **Orphan detection** — pages with fewer than 3 inbound links (weak internal SEO signal)
- **Hub strength** — whether /platforms is distributing link equity effectively to profiles

The link graph is stored week-over-week, so trends are visible: "Comparison pages gained 4 new inbound links this week after you added cross-links."

**Schema (v1.2.0 addition):**

The link graph stores both edge-level data (for debugging which pages link where) and aggregated inbound counts (for the report). Edges are stored per-run; summaries are derived.

```sql
CREATE TABLE sentinel_link_graph (
  id            BIGSERIAL PRIMARY KEY,
  run_id        BIGINT REFERENCES sentinel_runs(id),
  source_url    TEXT NOT NULL,              -- page containing the link
  target_url    TEXT NOT NULL,              -- page being linked to
  source_class  TEXT NOT NULL,              -- page class of source
  target_class  TEXT NOT NULL,              -- page class of target
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sentinel_links_run ON sentinel_link_graph(run_id);
CREATE INDEX idx_sentinel_links_target ON sentinel_link_graph(target_url, run_id);
```

**Derived metrics (computed in-memory after edge insert, written to `sentinel_snapshots.internal_links_in`):**

- Inbound count per URL = `COUNT(*) WHERE target_url = X AND run_id = current`
- Orphan = inbound count < 3
- Hub strength = average inbound count of all profile pages linked from /platforms

### 3.7 Content Freshness Watchdog

The crawler extracts the SSOT version string from authority pages (e.g. "Data derived from platform-config.json (SSOT v1.1.0)"). It compares this to the actual current version in the codebase.

If a mismatch is detected, the report flags: "Authority pages are serving SSOT v1.1.0 but the current version is v1.2.0 — ISR cache may be stale. Trigger a revalidation."

### 3.8 Regression Tripwire Alerts

For CRITICAL regressions only (page returning 4xx/5xx), the cron sends an immediate alert email — not waiting for Monday. This catches deploy-breaking issues within the cron's next scheduled run.

A lighter "tripwire" version runs daily at 06:00 (Tuesday–Sunday) that only checks HTTP status codes — no full extraction. If any authority page returns non-200, it fires an immediate alert.

**Tripwire rules:**

- Maximum 1 alert per URL per day (no email storms)
- Only fires for authority pages (page classes: hub, profile, guide, comparison, use_case, methodology)
- Product pages (leaderboard, inspire, etc.) are excluded from tripwires

Tripwire cron addition to `vercel.json`:

```json
{
  "path": "/api/sentinel/tripwire",
  "schedule": "0 6 * * 2-7"
}
```

### 3.9 The Monday Report (Phase 1 version)

The cron formats the results as a structured email sent via Resend (transactional email service, free tier: 3,000 emails/month).

**Report structure:**

```
PROMAGEN SENTINEL — Week of 14 April 2026
Run #12 — 57/57 pages crawled in 4.2s
══════════════════════════════════════════

HEALTH: 57/57 pages responding (100%)
REGRESSIONS THIS WEEK: 2 (3 suppressed)

🔴 CRITICAL
  (none)

🟠 HIGH
  /platforms — meta description still missing (week 3)
  /platforms/midjourney — JSON-LD FAQPage schema disappeared

🟡 MEDIUM
  /platforms/compare/midjourney-vs-dalle — word count dropped 23%
    (was 1,240 → now 954)

✅ IMPROVEMENTS THIS WEEK
  /platforms/negative-prompts — meta description added (was missing)
  /platforms/flux — gained 3 new inbound internal links

📊 COVERAGE SUMMARY
  Meta descriptions: 4/57 present (7%) ← lowest priority gap
  Canonical tags: 0/57 present (0%) ← second priority gap
  JSON-LD schema: 52/57 pages have schema (91%)
  Average response time: 340ms (no change)

🔗 LINK GRAPH (top 5 most-linked)
  /platforms ← 42 internal links
  /platforms/negative-prompts ← 18
  /platforms/midjourney ← 14
  /guides/prompt-formats ← 8
  / (homepage) ← 6

🔗 ORPHAN ALERT (pages with <3 inbound links)
  /platforms/compare/canva-vs-adobe-firefly ← 1
  /platforms/compare/ideogram-vs-midjourney ← 1
  /guides/best-generator-for/concept-art ← 2

🔇 SUPPRESSED (3)
  /pro-promagen H1 change (intentional redesign, expires 28 Apr)
  /inspire content shrink (seasonal content rotation)
  /status word count drop (expected)

⏭️ TOP 3 ACTIONS THIS WEEK
  1. Fix: /platforms/midjourney FAQPage schema (regression)
  2. Add meta descriptions to /platforms and /platforms/midjourney
  3. Add internal links to orphaned comparison pages

📈 EVIDENCE APPENDIX
  Top 5 changed URLs (by word count delta): [...]
  Top 5 orphan risks: [...]
```

### 3.10 Crawl Controls

| Control           | Value                                          | Rationale                                   |
| ----------------- | ---------------------------------------------- | ------------------------------------------- |
| Concurrency       | 5 parallel fetches                             | Respectful to own infrastructure            |
| Timeout per page  | 10 seconds                                     | Catches hung pages without blocking the run |
| Retries           | 1 retry after 3s delay                         | Handles transient failures                  |
| User-Agent        | `PromagenSentinel/1.0 (+https://promagen.com)` | Identifiable in own logs                    |
| Max pages per run | 100                                            | Safety ceiling (current: 57)                |
| robots.txt        | Not checked (own site)                         | Sentinel crawls its own pages only          |

### 3.11 Snapshot Retention (v1.1.0 addition)

| Data                  | Retention                        | Rationale                             |
| --------------------- | -------------------------------- | ------------------------------------- |
| sentinel_runs         | 52 weeks (1 year)                | Full run history for annual review    |
| sentinel_snapshots    | 26 weeks (6 months) raw          | Enough for trend analysis             |
| sentinel_regressions  | Forever (resolved ones archived) | Regression history is the audit trail |
| sentinel_suppressions | Until expired + 30 days          | Cleanup after expiry                  |

A monthly cleanup cron deletes snapshots older than 26 weeks. Runs older than 52 weeks are summarised into a `sentinel_run_summaries` row (page count, regression count, coverage percentages) before deletion.

**Summary schema (v1.2.0 addition):**

```sql
CREATE TABLE sentinel_run_summaries (
  id                BIGSERIAL PRIMARY KEY,
  run_date          DATE NOT NULL UNIQUE,
  pages_total       INT NOT NULL,
  pages_healthy     INT NOT NULL,            -- status 200
  meta_desc_count   INT NOT NULL,
  canonical_count   INT NOT NULL,
  schema_count      INT NOT NULL,
  regressions_total INT NOT NULL,
  regressions_critical INT NOT NULL,
  regressions_high  INT NOT NULL,
  orphan_count      INT NOT NULL,            -- pages with <3 inbound links
  health_score      NUMERIC(5,2) NOT NULL,   -- composite 0–100 (see §7)
  avg_response_ms   INT,
  ai_referrals_total INT,                    -- from Phase 2 (null if Phase 2 not yet active)
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

This table is the long-term trend line. After 52 weeks, raw snapshots are gone but the weekly summary survives indefinitely. A simple query on `sentinel_run_summaries` shows the full health trajectory of the site.

### 3.12 Failure Handling (v1.1.0 addition)

| Failure                        | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sitemap fetch fails            | Run status = failed, reason logged, alert email sent                                                                                                                                                                                                                                                                                                                                                      |
| N pages timeout (N < total/2)  | Continue crawl, note "X pages timed out" in report                                                                                                                                                                                                                                                                                                                                                        |
| N pages timeout (N >= total/2) | Abort crawl, run status = failed, alert email sent                                                                                                                                                                                                                                                                                                                                                        |
| Regression diff fails          | Snapshots are already persisted. Run status = failed at diff stage. Report sends with "Diff incomplete" warning                                                                                                                                                                                                                                                                                           |
| Resend email fails             | Run status = failed at report stage. All data is persisted. One automatic retry after 60 seconds within the same invocation. If retry fails, run is marked `report_sent = false`. The next Monday's cron checks for unsent reports from the previous week and includes a "Last week's report failed to send — data was preserved" note. Old reports are never re-sent in full; only the flag is surfaced. |
| GA4 API fails (Phase 2)        | Report sends without AI referral section. Note: "GA4 data unavailable this week"                                                                                                                                                                                                                                                                                                                          |
| Anthropic API fails (Phase 3)  | Report sends without AI analysis section. Raw data still included                                                                                                                                                                                                                                                                                                                                         |

**Rule:** Sentinel never throws away data because a downstream step failed. Persist first, report second.

### 3.13 Cron Configuration

```json
{
  "path": "/api/sentinel/cron",
  "schedule": "0 6 * * 1"
}
```

Pattern follows existing crons: protected by `PROMAGEN_CRON_SECRET`, uses `requireCronSecret()` from `src/lib/env.ts`, returns structured JSON response for observability.

### 3.14 File Structure (v2.0.0 — 24 modules + 3 routes + 1 dashboard + 1 test suite)

```
src/
  app/
    api/
      sentinel/
        cron/
          route.ts                -- Monday cron handler (crawl → diff → email)
        tripwire/
          route.ts                -- Daily status-only check (Tue–Sun)
        selftest/
          route.ts                -- Parser verification endpoint (Extra 6)
    admin/
      sentinel/
        page.tsx                  -- Weekly Digest Dashboard (Extra 8)
  components/
    sentinel/
      dashboard.tsx               -- Dashboard client component (Extra 8)
  lib/
    sentinel/
      -- CORE (Phase 1) --
      crawler.ts                  -- Parallel fetch, bounded concurrency
      extraction.ts               -- Hardened HTML extractors (Extra 9, 10 functions)
      page-classifier.ts          -- URL → page class (8 classes)
      database.ts                 -- Auto-migration, advisory lock, CRUD
      snapshot.ts                 -- Snapshot writer + link graph builder
      run-manager.ts              -- Full lifecycle orchestrator
      regression.ts               -- Week-over-week diff + forensic capture (Extra A)
      suppression.ts              -- Apply/check suppressions
      auto-suppression.ts         -- JSON config-driven rules engine (Extra 7)
      link-graph.ts               -- Hub strength + orphan analysis
      freshness.ts                -- SSOT version comparison
      health-score.ts             -- Composite 0–100 score (§7)
      report-formatter.ts         -- Monday email body
      report-archive.ts           -- Full report text storage (Extra 6)
      email.ts                    -- Resend API + 60s retry
      dashboard-data.ts           -- Server-side data for dashboard (Extra 8)

      -- EXTRAS --
      citation-velocity.ts        -- Rate of change per query (Extra B)
      regression-streak.ts        -- Consecutive weeks + auto-escalation (Extra 3)
      regression-heatmap.ts       -- Page class × regression type matrix (Extra 5)
      snapshot-diff.ts            -- Field-by-field diff + forensic decompress (Extra 4)
      signal-correlation.ts       -- Pearson + lag across all signals (Extra 11)
      page-authority-score.ts     -- Per-page 0–100 authority ranking (Extra 12)

      -- PHASE 2 INFRASTRUCTURE --
      ga4-client.ts               -- GA4 Data API skeleton
      canary.ts                   -- AI crawler detection (5 bots)
  __tests__/
    sentinel/
      sentinel-core.test.ts       -- 30 pure-function tests
      sentinel-extraction.test.ts -- 42 extraction edge-case tests
```

### 3.15 Environment Variables

```env
# Sentinel
RESEND_API_KEY=re_...                    -- Resend transactional email API key
SENTINEL_EMAIL_TO=martin@promagen.com    -- Report recipient
SENTINEL_ENABLED=true                    -- Kill switch (false = cron returns 200, does nothing)
```

---

## 4. Phase 2 — Intelligence (GA4 + Crawler Logs)

### 4.1 What It Adds

Phase 2 connects Sentinel to the data that already exists in Promagen's analytics stack. It does not rebuild analytics — it consumes the existing contract.

Promagen already has:

- `ai_citation_landing` event fired by `useAiCitationDetector()` hook (wired in root layout)
- `provider_outbound` conversion events with session journey snapshots
- `provider_activity_events` table (server-side truth for outbound clicks)
- GA4 custom dimensions for `ai_source` and `landing_page`

Phase 2 pulls the previous week's data from GA4 using the Google Analytics Data API and merges it into the Monday report.

### 4.2 GA4 Data API Call

```typescript
const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const client = new BetaAnalyticsDataClient();

const [response] = await client.runReport({
  property: `properties/${GA4_PROPERTY_ID}`,
  dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
  dimensions: [{ name: "sessionSource" }, { name: "landingPage" }],
  metrics: [{ name: "sessions" }, { name: "conversions" }],
  dimensionFilter: {
    filter: {
      fieldName: "sessionSource",
      inListFilter: {
        values: [
          "chatgpt.com",
          "perplexity.ai",
          "claude.ai",
          "gemini.google.com",
        ],
      },
    },
  },
});
```

### 4.3 AI Crawler Detection (Canary System)

Vercel logs record User-Agent strings. Phase 2 analyses these for known AI crawler signatures:

| Bot             | User-Agent Contains | What It Means                      |
| --------------- | ------------------- | ---------------------------------- |
| OAI-SearchBot   | `OAI-SearchBot`     | OpenAI indexing for ChatGPT search |
| GPTBot          | `GPTBot`            | OpenAI training/indexing           |
| ClaudeBot       | `ClaudeBot`         | Anthropic indexing for Claude      |
| PerplexityBot   | `PerplexityBot`     | Perplexity indexing                |
| Google-Extended | `Google-Extended`   | Google indexing for Gemini         |

The Monday report includes: "ClaudeBot visited 12 pages this week (down from 18 last week). GPTBot visited 0 pages (has not crawled in 3 weeks)."

**Implementation note (v1.1.0):** The exact log retrieval mechanism is TBD. Vercel provides log access via dashboard, CLI (`vercel logs`), and Log Drains (Datadog, etc.). The cron-friendly path needs investigation before build. Options: Vercel Log Drain to Postgres, CLI-based extraction, or Vercel's runtime logs API. This will be resolved during Phase 2 build, not pre-specified.

**Schema (v1.2.0 addition):**

Regardless of ingestion method, the storage contract is defined so downstream consumers (report, analyst) have a stable interface:

```sql
CREATE TABLE sentinel_crawler_visits (
  id            BIGSERIAL PRIMARY KEY,
  run_id        BIGINT REFERENCES sentinel_runs(id),
  week_date     DATE NOT NULL,              -- Monday of the reporting week
  bot_name      TEXT NOT NULL,              -- 'OAI-SearchBot', 'GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'
  url           TEXT NOT NULL,              -- page visited
  visit_count   INT NOT NULL DEFAULT 1,    -- visits to this URL by this bot this week
  first_seen    TIMESTAMPTZ,               -- earliest visit timestamp (if available from source)
  last_seen     TIMESTAMPTZ,               -- latest visit timestamp
  source        TEXT NOT NULL,              -- 'log_drain' | 'cli_extract' | 'manual'
  confidence    TEXT NOT NULL DEFAULT 'full', -- 'full' | 'partial' (if logs were incomplete)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sentinel_crawler_week ON sentinel_crawler_visits(week_date, bot_name);
```

**Confidence flag:** If the log source was incomplete (e.g. Vercel CLI only returns last 24h of logs), the `confidence` field is set to `partial` and the report notes: "Crawler data is partial this week — based on [source]."

### 4.4 Monday Report Addition (Phase 2)

The Phase 1 report gains two new sections:

```
🤖 AI REFERRALS THIS WEEK
  ChatGPT: 14 sessions (▲ +6 from last week)
    Top landing: /platforms/midjourney (8), /platforms/negative-prompts (4)
  Perplexity: 7 sessions (▼ -2)
    Top landing: /platforms (5), /about/how-we-score (2)
  Claude: 3 sessions (no change)
  Gemini: 0 sessions

🕷️ AI CRAWLER ACTIVITY
  ClaudeBot: 12 pages visited (▼ from 18)
  OAI-SearchBot: 8 pages visited (▲ from 3)
  PerplexityBot: 22 pages visited (no change)
  GPTBot: 0 pages (last seen: 3 weeks ago ⚠️)
```

### 4.5 File Additions

```
src/
  lib/
    sentinel/
      ga4-client.ts             -- GA4 Data API wrapper
      canary.ts                 -- AI crawler log analysis
```

### 4.6 Environment Variables

```env
GA4_PROPERTY_ID=123456789
GA4_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SENTINEL_CANARY_ENABLED=true
```

---

## 5. Phase 3 — Analyst (Claude AI Review)

### 5.1 What It Adds

After Phase 1 collects the raw data and Phase 2 adds AI referral context, Phase 3 sends the entire dataset to the Anthropic API and asks Claude to produce a prioritised analysis. The AI layer adds:

- **Prioritisation reasoning** — not just "meta description missing" but "this page gets the most AI crawler visits and has no meta description, so it's your highest-ROI fix"
- **Trend detection** — "Word count on comparison pages has declined for 3 consecutive weeks — investigate whether ISR is serving stale content"
- **Cross-layer intelligence** — "Your /platforms/negative-prompts page has 18 inbound links but zero AI referrals. The canary shows ClaudeBot visited it 4 times this week — citations may appear within 1–2 weeks"

### 5.2 API Call Structure

```typescript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: process.env.SENTINEL_ANALYST_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SENTINEL_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: JSON.stringify({
        crawl_date: '2026-04-14',
        run_id: 12,
        total_pages: 57,
        regressions: [...],
        suppressions_active: 3,
        coverage: { meta_desc: '4/57', canonical: '0/57', ... },
        link_graph_orphans: [...],
        week_over_week_changes: [...],
        ai_referrals: { chatgpt: 14, perplexity: 7, claude: 3, gemini: 0 },
        crawler_visits: { claudebot: 12, oai_searchbot: 8, perplexitybot: 22, gptbot: 0 },
        improvements_this_week: [...],
      })
    }],
  }),
});
```

### 5.3 System Prompt (Sentinel Analyst)

```
You are Sentinel Analyst, the AI monitoring layer for Promagen.com.

You receive a weekly crawl snapshot of Promagen's public pages combined with
AI referral data and crawler visit logs. Your job is to produce a prioritised
action report for the site owner.

Rules:
- Lead with the single highest-impact action. Not a list — one thing.
- Rank every recommendation by ROI (effort vs impact on AI visibility).
- Flag trends across multiple weeks, not just point-in-time issues.
- Cross-reference crawl data with AI referral data. A page with high crawler
  visits but missing metadata is higher priority than a perfect page with
  no traffic.
- Be specific: name the URL, the exact problem, and the exact fix.
- Include a "Newly improved" section — acknowledge fixes, not just problems.
- Never recommend things that are already done.
- Never pad the report. If nothing is wrong, say "No action needed this week."
- Use plain English. No jargon. No marketing language.
- Maximum 500 words.
```

### 5.4 Cost

Approximately $0.02–0.05 per weekly run (~2,000 input tokens, ~800 output tokens). Annual cost: ~$1–3.

### 5.5 File Additions

```
src/
  lib/
    sentinel/
      analyst.ts                -- Calls Anthropic API, parses response
      analyst-prompt.ts         -- System prompt (single source of truth)
```

### 5.6 Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
SENTINEL_ANALYST_MODEL=claude-sonnet-4-20250514   -- Env var, not hardcoded
SENTINEL_ANALYST_ENABLED=true                      -- Can disable AI layer independently
```

---

## 6. Optional Extra — Competitive Shadow Crawl

**Status:** Not in any phase. Build only if strategically needed.

The Monday crawl also fetches the sitemaps of 2–3 competitor sites (configurable) and records: page count, new URLs added since last week, title keywords. This is a light crawl — no full content extraction, just structural awareness.

| Competitor | URL            | Why Track                  |
| ---------- | -------------- | -------------------------- |
| PromptHero | prompthero.com | Largest prompt marketplace |
| Lexica     | lexica.art     | Prompt search engine       |
| PromptBase | promptbase.com | Prompt marketplace         |

The report includes one paragraph: "PromptHero added 12 new pages this week. No new authority-style content detected."

**Build trigger:** Only build this if competitive intelligence becomes a decision factor. Not speculative.

---

## 7. Health Score Formula (v1.2.0 addition)

The Monday report includes a single composite health score (0–100) that tracks the overall state of Promagen's public pages. This is not a vanity metric — it is a governed output with a stable, transparent formula.

**Formula:**

| Component             | Weight | What It Measures                                 | Scoring                                                                          |
| --------------------- | ------ | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Availability          | 40%    | Pages returning HTTP 200                         | `(pages_200 / pages_total) × 100`                                                |
| Metadata completeness | 20%    | Pages with title + meta description + canonical  | `(pages_with_all_three / pages_total) × 100`                                     |
| Schema presence       | 15%    | Pages with at least one JSON-LD schema type      | `(pages_with_schema / pages_total) × 100`                                        |
| Regression burden     | 15%    | Inverse of unresolved non-suppressed regressions | `max(0, 100 - (active_regressions × 5))` — each active regression costs 5 points |
| Orphan risk           | 10%    | Pages with 3+ inbound internal links             | `(pages_not_orphaned / pages_total) × 100`                                       |

**Composite:** `(Availability × 0.40) + (Metadata × 0.20) + (Schema × 0.15) + (Regression × 0.15) + (Orphan × 0.10)`

**Example (current state):**

- Availability: 57/57 = 100 × 0.40 = **40.0**
- Metadata: 4/57 have all three = 7 × 0.20 = **1.4**
- Schema: 52/57 = 91 × 0.15 = **13.7**
- Regression: 2 active = (100 - 10) × 0.15 = **13.5**
- Orphan: 54/57 with 3+ links = 95 × 0.10 = **9.5**
- **Total: 78.1/100**

The health score appears at the top of every Monday report and is stored in `sentinel_run_summaries` for long-term trend tracking. A score below 80 is flagged amber. Below 60 is flagged red.

**Why this formula works:** Availability dominates (40%) because a page that's down is worse than a page with missing metadata. Metadata and schema together are 35% because they directly affect AI citation. Regression burden penalises accumulating unfixed issues. Orphan risk catches pages that exist but aren't discoverable.

---

## 8. Authoritative Source Map (v1.2.0 addition)

Sentinel consumes data from multiple sources. When sources disagree, this table defines which one wins:

| Signal                                                                         | Source of Truth                                                          | Secondary Source              | If They Disagree                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------- |
| Page health (status, title, meta, schema)                                      | Sentinel crawl                                                           | None                          | Sentinel is the only source                                                           |
| AI referral sessions                                                           | GA4 Data API (`ai_citation_landing` events)                              | None                          | GA4 is the only source for referral discovery                                         |
| Conversion truth (did AI-referred users actually click through to a provider?) | Server-side: `provider_activity_events` table + `/go/[providerId]` route | GA4 `provider_outbound` event | Server-side wins. GA4 is directional only (blocked by ad-blockers, not authoritative) |
| AI crawler activity                                                            | Sentinel canary (from Vercel logs)                                       | None                          | Canary is the only source. Confidence flag indicates data completeness                |
| Manual citation scores                                                         | Citation Cockpit (browser persistent storage)                            | None                          | Cockpit is the only source. Single-device by design                                   |
| Internal link graph                                                            | Sentinel crawl (edge-level)                                              | None                          | Crawl is the only source                                                              |
| Content freshness                                                              | Sentinel crawl (SSOT version comparison)                                 | None                          | Crawl is the only source                                                              |

**Rule:** The Monday report and the Claude Analyst (Phase 3) must use the authoritative source for each signal. If the authoritative source is unavailable, the report notes the gap rather than falling back to a secondary source for truth claims.

This aligns with Promagen's existing analytics authority chain: `analytics-build-plan-v1.3-FINAL.md` §3 defines GA4 as supplementary and server-side telemetry as authoritative for conversion events.

---

## 9. The Manual Layer — Citation Cockpit

### 9.1 Why This Stays Manual

There is no legitimate API to automate "ask ChatGPT a question and record the answer." OpenAI, Anthropic, Perplexity, and xAI all prohibit automated scraping of their consumer chat interfaces. Building a bot to do this would violate their terms of service.

The manual citation test takes 25 minutes per week and provides data that no automated system can replicate: what does the AI actually say about you, in its own words, when a real user asks?

### 9.2 The Citation Cockpit

The cockpit is an interactive browser-based tool (React artifact with persistent storage). It serves as both the recording surface and the operational control panel for the manual layer of Sentinel.

**Tab 1 — Prompt Library**

All six site-scraping prompts, ready for one-click copy. Each prompt has:

- Name and description
- Full prompt text with copy button
- Recommended AI platform
- "Last Run" date (updated when you run it)
- "Key Finding" field (one-sentence summary of what the scrape revealed)

**Tab 2 — Citation Scorecard**

12 target queries × 4 AI platforms × 12 weeks of tracking.

**Scoring:**

| Score | Meaning                                  | Colour    |
| ----- | ---------------------------------------- | --------- |
| 3     | Promagen named + linked                  | Green     |
| 2     | Promagen named, no link                  | Amber     |
| 1     | Concept described but Promagen not named | Light red |
| 0     | Not mentioned at all                     | Red       |

**Target queries:**

| #   | Query                                              | Category          | Target Page                             |
| --- | -------------------------------------------------- | ----------------- | --------------------------------------- |
| 1   | best AI image generator for photorealism           | Use-case          | /guides/best-generator-for/photorealism |
| 2   | Midjourney negative prompt                         | Platform-specific | /platforms/midjourney                   |
| 3   | how to write prompts for DALL-E 3                  | Platform-specific | /platforms/openai                       |
| 4   | CLIP vs natural language prompts                   | Educational       | /guides/prompt-formats                  |
| 5   | AI image generator comparison 2026                 | Authority         | /platforms                              |
| 6   | which AI image generators support negative prompts | Feature audit     | /platforms/negative-prompts             |
| 7   | best prompt format for Stable Diffusion            | Platform-specific | /platforms/stability                    |
| 8   | Midjourney vs DALL-E comparison                    | Comparison        | /platforms/compare/midjourney-vs-dalle  |
| 9   | how are AI image generators scored                 | Methodology       | /about/how-we-score                     |
| 10  | AI prompt builder tool                             | Product discovery | /                                       |
| 11  | Flux prompt format guide                           | Platform-specific | /platforms/flux                         |
| 12  | Leonardo AI prompt tips                            | Platform-specific | /platforms/leonardo                     |

**Cockpit features:**

- Click any cell to cycle through scores (0 → 1 → 2 → 3 → 0)
- Cells auto-colour based on score
- Row totals per query (sum across all 4 platforms)
- Column totals per platform per week
- Trend arrows (▲/▼ with delta from previous week)
- Notes field per week for each query
- All data persists in browser storage between sessions
- Export to clipboard as formatted text

**Storage note (v1.2.0 addition):**

The Cockpit uses Claude artifact persistent storage (`window.storage` API). This is intentionally single-device — it is a personal operator tool, not a shared database. If storage is cleared, citation history is lost. For backup, the export-to-clipboard function produces a formatted text snapshot that can be pasted into a document or spreadsheet. The Cockpit is not the system of record for anything except manual citation scores — it is lightweight by design. If multi-device sync becomes necessary, the data model is simple enough to migrate to Postgres alongside the Sentinel tables.

### 9.3 Weekly Process (25 minutes)

1. Open the cockpit
2. Check which prompts are overdue (Last Run column)
3. For each of the 12 queries, paste into ChatGPT, Perplexity, Claude, Grok
4. Click cells to score 0–3
5. Note any interesting quotes in the Notes field
6. Review trend arrows — which queries are improving, which are declining

After 4 weeks, correlate citation scores with GA4 AI referral data from Phase 2.

---

## 10. Build Priority (v2.0.0 — updated with completion status)

| Part | Phase    | What                                               | Status     | Sessions |
| ---- | -------- | -------------------------------------------------- | ---------- | -------- |
| 1    | Manual   | Citation Cockpit (React artifact)                  | ✅ DONE    | 1        |
| 2    | Phase 1  | Run manager + crawler + snapshot tables            | ✅ DONE    | 1        |
| 3    | Phase 1  | Regression detection + suppression tables          | ✅ DONE    | 2        |
| 4    | Phase 1  | Monday report email via Resend                     | ✅ DONE    | 2        |
| 5    | Phase 1  | Link graph scoring + orphan detection              | ✅ DONE    | 3        |
| 6    | Phase 1  | Tripwire daily cron (status-only)                  | ✅ DONE    | 3        |
| 7    | Phase 1  | Content freshness watchdog                         | ✅ DONE    | 1        |
| 8    | Phase 2  | GA4 Data API integration (consume existing events) | 🔧 INFRA   | 4        |
| 9    | Phase 2  | AI crawler canary (investigate + build)            | 🔧 INFRA   | 4        |
| 10   | Phase 3  | Claude API analyst layer                           | ⏳ FUTURE  | —        |
| 11   | Optional | Competitive shadow crawl                           | ⏳ FUTURE  | —        |
| 12   | Done     | /admin/sentinel dashboard                          | ✅ DONE    | 5        |

**Phase 1 is complete.** 24 modules + 3 API routes + 1 admin dashboard + 72 tests. Phase 2 infrastructure (ga4-client.ts, canary.ts) is built and returns clean "not configured" until GA4 credentials arrive. Phase 3 is future work.

**Remaining to deploy:** env.ts integration (3 env vars), Neon migration (7 tables), vercel.json crons (2 entries), Resend account setup.

---

## 11. What Sentinel Does NOT Cover

- **Prompt builder quality** — covered by BQI and the harmony pass system
- **Platform data accuracy** — covered by platform-config.json SSOT and trend-analysis.md
- **Financial metrics** — covered by Stripe dashboard and GA4 ecommerce (when enabled)
- **User behaviour analytics** — covered by GA4 + analytics-build-plan
- **Content creation** — Sentinel monitors content, it does not write it
- **Google re-crawl requests** — use GSC manual URL inspection. Google's Indexing API is restricted to job postings and livestream pages, not general content.

---

## 12. Success Metrics

After 4 weeks of Sentinel operation, you should be able to answer:

1. "How many of my 57 authority pages have complete metadata?" (target: 100%)
2. "Which pages are orphaned from the link graph?" (target: zero pages with <3 inbound links)
3. "Are AI crawlers visiting my authority pages, and how often?" (target: weekly visits from all 4 major bots)
4. "Which AI platforms cite Promagen, and for which queries?" (from manual scorecard)
5. "Are users arriving from AI platforms, and do they convert?" (from GA4 + ai_citation_landing)
6. "Has any deploy broken an authority page this week?" (target: zero unresolved CRITICAL regressions)

After 8 weeks, correlation analysis becomes possible: "When we added meta descriptions to platform profiles (week 3), Perplexity citations increased from 2 to 7 over the following 4 weeks."

---

## 13. Non-Regression Rules

- Sentinel cron routes must not modify any existing page, component, or data file
- Sentinel must not call any existing API route (it reads public pages as an external visitor)
- Sentinel database tables are prefixed `sentinel_` and do not share tables with any other feature
- Sentinel email sending must not interfere with any future transactional email (e.g. Stripe receipts)
- The tripwire cron must not send more than 1 alert per URL per day (no email storms)
- Sentinel must respect the `SENTINEL_ENABLED` kill switch — if false, the cron returns 200 with `{ skipped: true }` and does nothing
- All Sentinel code lives under `src/lib/sentinel/` and `src/app/api/sentinel/` — no files outside these paths
- Sentinel consumes existing analytics contracts (events.ts, session-journey.ts, ai-citation-detector) — it does not create parallel analytics

---

## 15. Extras Catalogue (v2.0.0)

Twelve extras built across Sessions 1–6. All bolt onto the core architecture with no structural changes. Each is independently useful.

| #   | Name                               | File                          | What It Does                                                                                                                                                                                              | When Active                           |
| --- | ---------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A   | Regression Forensics Snapshots     | `regression.ts`               | Gzips raw HTML at detection time for CRITICAL/HIGH regressions. ~2KB per snapshot. Creates before/after evidence trail.                                                                                   | From first regression                 |
| B   | Citation Velocity Index            | `citation-velocity.ts`        | Linear regression slope over rolling 4-week window per query per platform. Reports accelerating/decelerating/stable trends.                                                                               | After 4 weeks of Cockpit data         |
| 3   | Regression Streak Counter          | `regression-streak.ts`        | Tracks consecutive weeks unresolved. Report shows "(week 3)". Auto-escalates MEDIUM→HIGH after 4 weeks.                                                                                                  | From first repeat regression          |
| 4   | Snapshot Diff Viewer               | `snapshot-diff.ts`            | Field-by-field structured diff between before/after snapshots. Decompresses forensic gzip. Shows exactly what changed.                                                                                    | When forensic snapshots exist         |
| 5   | Regression Heatmap                 | `regression-heatmap.ts`       | Page class × regression type frequency matrix over 8-week window. Surfaces systemic patterns with actionable suggestions.                                                                                 | After 8 weeks of data                 |
| 6   | Self-Test + Report Archive         | `selftest/route.ts`, `report-archive.ts` | Self-test crawls 3 known pages and verifies extraction. Report archive stores full Monday email text for dashboard history.                                                                      | Immediate                             |
| 7   | Auto-Suppression Rules             | `auto-suppression.ts`         | JSON config-driven suppression engine. Rules like "suppress h1_changed on product pages always". Creates/expires suppressions automatically.                                                              | Immediate                             |
| 8   | Weekly Digest Dashboard            | `dashboard.tsx`, `dashboard-data.ts`, `page.tsx` | `/admin/sentinel` — health score trend, regression sparkline, weekly report cards, unresolved regression list. Clerk-protected via existing admin middleware.                               | After first Monday run                |
| 9   | Crawler Extraction Hardening       | `extraction.ts`               | 10 robust pure-function extractors replacing inline regex. Handles attribute reordering, multi-line tags, entity decoding. 42 edge-case tests.                                                            | Immediate (replaces v1 extractors)    |
| 10  | Link Graph Hub Strength            | `link-graph.ts`               | Average inbound count of profile pages linked from /platforms. Measures how well the hub distributes link equity. Orphans broken down by page class.                                                       | From first crawl                      |
| 11  | Signal Correlation Engine          | `signal-correlation.ts`       | Pearson correlations + lag analysis across all weekly time series (health, regressions, crawler visits, citations, referrals). Proves which actions produce which results.                                 | After 8 weeks of data                 |
| 12  | Page Authority Score (PAS)         | `page-authority-score.ts`     | Per-page composite 0–100 from metadata completeness (25%), inbound links (20%), content depth (15%), regression history (20%), schema richness (10%), performance (10%). Ranked leaderboard with per-page recommendations. | From first crawl                      |

---

## 14. Changelog

- **10 Apr 2026 (v1.0.0):** Initial specification. Three-phase architecture. Six extras. Manual citation scorecard. Full build priority.
- **10 Apr 2026 (v1.1.0):** Incorporates independent ChatGPT review (scored 92/100). Changes: removed Google Indexing API (wrong tool for authority pages — restricted to job postings/livestreams). Added sentinel_runs table with run lifecycle states. Added suppression/acknowledgement workflow. Added page classes with class-aware regression thresholds. Added minimum history requirements for baseline-dependent regressions. Added failure handling rules (degrade cleanly, persist partial data). Added snapshot retention policy. Added crawl controls (concurrency, timeout, retries, user-agent). Changed model pin from hardcoded string to SENTINEL_ANALYST_MODEL env var. Reordered phases: GA4 moved to Phase 2 (consume existing analytics early), Claude Analyst moved to Phase 3 (last, operates on trusted signals). Competitive shadow crawl demoted from Phase 3 to optional extra. Canary implementation mechanism changed from "specified" to "investigate during build." Added "Improvements this week" section to Monday report. Renamed manual spreadsheet to "Citation Cockpit."
- **9 Apr 2026 (v2.0.0):** Phase 1 BUILD COMPLETE. 24 modules, 3 API routes, 1 admin dashboard, 72 tests. Updated file structure (§3.14) reflecting full build. Added §15 Extras Catalogue documenting all 12 extras: forensic snapshots (A), citation velocity (B), streak counter (3), snapshot diff (4), regression heatmap (5), self-test + report archive (6), auto-suppression rules (7), weekly digest dashboard (8), extraction hardening (9), link graph hub strength (10), signal correlation engine (11), page authority score (12). Phase 2 infrastructure ready (ga4-client.ts, canary.ts). Sentinel Cockpit updated with Citation Velocity tab, competitor mention tracking, per-query sparklines, and improved export. SQL migration v2 fixes NOW() partial index. Crawler refactored to use hardened extraction module.
- **10 Apr 2026 (v1.2.0):** Incorporates second ChatGPT review (scored 95/100). Changes: added sentinel_link_graph schema with edge-level storage (§3.6). Added sentinel_crawler_visits schema with confidence flag (§4.3). Added sentinel_run_summaries schema for long-term trend retention (§3.11). Added idempotency and duplicate-run rules with advisory lock, rerun handling, and unique partial index (§3.2.1). Added authoritative source map defining which data source wins when sources disagree, aligned with existing analytics authority chain (§8). Added class-specific regression threshold matrix — full policy table for all 8 page classes × 10 regression types (§3.4). Added composite health score formula with weighted components: availability 40%, metadata 20%, schema 15%, regression burden 15%, orphan risk 10% (§7). Added suppression SQL command reference with examples (§3.5). Tightened email retry contract: one automatic retry within invocation, no full re-send of old reports (§3.12). Added cockpit storage note clarifying single-device design, backup via export, and migration path (§9.2). Updated sentinel_runs schema with run_type, is_rerun fields and unique partial index.
