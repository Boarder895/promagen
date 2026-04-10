# Promagen To-Do

**Updated:** 10 April 2026
**Owner:** Martin Yarnold
**Rule:** Only uncompleted tasks. No completed items. Cross-referenced against `src.zip` (the SSoT), project memory, and all chat history.

---

## P1 — Revenue-Critical

| #   | Item                                 | Detail                                                                                                                                                                                                                                                                                                                                                                                                        | Source                          |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1.1 | **GPT expansion cap problem**        | All 25 NL builders still show `idealMin–idealMax` in system prompts. GPT compresses toward that range even when the platform accepts far more (e.g. Midjourney `maxChars: 6000`). Agreed direction: remove char ranges from GPT visibility, hard rule "don't shorten below `maxChars`", computed expansion ceiling `idealMax × 2.5`. 14 platforms have `maxChars > 2.5× idealMax`. **Unsolved since 31 Mar.** | Chat: Call 3 (31 Mar)           |
| 1.2 | **5 builders missing DNI section**   | `group-nl-bing.ts`, `group-nl-craiyon.ts`, `group-nl-imagine-meta.ts`, `group-nl-pixlr.ts`, `group-nl-simplified.ts` — only comment-level mentions of `negativeSupport: none`. Zero actual DNI logic. Users get no platform-optimised negative prompt on these platforms. Verified in src.zip 9 Apr.                                                                                                          | Chat: Call 3 (2 Apr)            |
| 1.3 | **Negative prompts invisible in UI** | `aiOptimiseResult.negative` is returned by Call 3 and stored in the hook but never rendered in the Prompt Lab. Zero references to `.negative` rendering in `src/components/prompt-lab/`. All Dynamic Negative Intelligence output is invisible to users. Verified in src.zip 9 Apr.                                                                                                                           | Chat: Optimizing top 6 (27 Mar) |
| 1.4 | **Analytics build plan Parts 1–8**   | Plan scored 98/100 (ChatGPT). `recordPromptQuality()` defined in `prompt-quality-correlation.ts` but NOT wired — zero call sites in `app/` or `hooks/`. 4 broken imports from deleted analytics files (`@/lib/analytics/providers`, `@/lib/analytics/nav`) need the convenience wrappers from Parts 2–3. `prompt_lab_optimise` event defined but pending wiring (12 of 12 event types).                       | Chat: Analytics (9 Apr)         |

---

## P2 — Architecture / Dead Code

| #    | Item                                                     | Detail                                                                                                                                                                                                                                                                                                       | Source                                |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| 2.1  | **Fold `_assemblyDefaults` into `platform-config.json`** | `platform-formats.json` still exists (46KB) holding `_assemblyDefaults`. Once confirmed stable, merge into `platform-config.json` and delete entirely. Verified: still present in `src/data/providers/`. 9 Apr.                                                                                              | Chat: Platform consolidation (27 Mar) |
| 2.2  | **8 stale authority references in builder files**        | 8 files in `src/lib/optimise-prompts/` still cite `grouping-45-image-platforms-by-prompt-compatibility.md` (deleted doc). Quick find-and-replace to current spec. Verified 8 hits 9 Apr.                                                                                                                     | Chat: Platform consolidation (27 Mar) |
| 2.3  | **Dead hooks cleanup**                                   | Multiple hooks in `src/hooks/` may have zero active imports. Original audit found ~15+ candidates. Needs re-audit against actual page routes.                                                                                                                                                                | Chat: Prompt Lab cleanup (25 Mar)     |
| 2.4  | **Orphaned test files**                                  | 52 test files (41 in `__tests__/`, 11 in `__tests__/admin/`) not matched by Jest config patterns. Providing zero CI protection.                                                                                                                                                                              | Chat: Test audit (25 Mar)             |
| 2.5  | **Delete `use-prompt-score.ts`**                         | Dead code. Call 4 user-facing scoring killed on 3 Apr. File: `src/hooks/use-prompt-score.ts`. Verified present 9 Apr.                                                                                                                                                                                        | Chat: Call 4 scoring (3 Apr)          |
| 2.6  | **Delete `xray-score.tsx`**                              | Dead code. Score display component killed on 3 Apr. File: `src/components/prompt-lab/xray-score.tsx`. Verified present 9 Apr.                                                                                                                                                                                | Chat: Call 4 scoring (3 Apr)          |
| 2.7  | **Delete `platform-match-rail.tsx`**                     | Dead code. Superseded by `leaderboard-rail.tsx`. File: `src/components/prompt-lab/platform-match-rail.tsx`. Verified present 9 Apr.                                                                                                                                                                          | Chat: Prompt Lab homepage (5 Apr)     |
| 2.8  | **Stale comments in `playground-page-client.tsx`**       | Line 28: header comment says "Left: PlatformMatchRail" but actual import is `LeaderboardRail`. Line 45: references `lefthand-rail.md v1.2.0` which is now v2.0.0. File: `src/app/studio/playground/playground-page-client.tsx`. Verified 9 Apr.                                                              | Chat: Leaderboard rail build (5 Apr)  |
| 2.9  | **Cron SQL filter gap — 6 of 12 event types**            | Index Rating cron queries only 6 event types. The 6 Prompt Lab events (`prompt_lab_select`, `prompt_lab_generate`, `prompt_lab_copy`, `prompt_lab_optimise`, `prompt_save`, `prompt_reformat`) have weights in `EVENT_CONFIG` but are excluded by hardcoded SQL `IN (...)` in `database.ts`. Verified 9 Apr. | Chat: Cron auth (6 Apr)               |
| 2.11 | **Grey text violations in provider components**          | `provider-detail.tsx`: 4× `text-slate-500`/`text-slate-400`. `prompt-builder.tsx`: 4× violations. `aspect-ratio-selector.tsx`: 7×. `length-indicator.tsx`: 3×. All in `src/components/providers/`. Verified 9 Apr.                                                                                           | Chat: Chat system build (6 Apr)       |
| 2.12 | **`code-standard.md` §6.0.2 contradicts enforced rule**  | Doc was updated 9 Apr (platform count fix, gallery mode removed) but §6.0.2 grey text rule may still contradict enforced standard. Verify after doc drop.                                                                                                                                                    | Chat: Chat system build (6 Apr)       |
| 2.13 | **Sentinel env.ts integration**                          | `SENTINEL_ENABLED`, `RESEND_API_KEY`, `SENTINEL_EMAIL_TO` not in `EnvSchema` or frozen `env` export in `src/lib/env.ts`. Need 3 lines in schema + sentinel block in export. Zero hits for "SENTINEL" in env.ts. Verified 9 Apr.                                                                              | Chat: Sentinel build (9 Apr)          |
| 2.14 | **Sentinel Neon migration**                              | Run `sql/sentinel-migration-v2.sql` in Neon console. Creates 7 tables. Migration file is in the repo but tables do not exist in production yet.                                                                                                                                                              | Chat: Sentinel build (9 Apr)          |
| 2.15 | **Sentinel vercel.json crons**                           | Monday cron (`/api/sentinel/cron`, `0 6 * * 1`) and tripwire (`/api/sentinel/tripwire`, `0 6 * * 2-7`). Files built, vercel.json delivery built, but not yet in deployed vercel.json.                                                                                                                        | Chat: Sentinel build (9 Apr)          |
| 2.16 | **Saved prompts `clearAll()` documentation**             | clearAll() is client-only reset (Option B). Cloud-aware "delete all" deferred. Hook at v3.0.2 with cloud shadow backup and op queue. Both items need documenting in saved-page.md.                                                                                                                           | Chat: Cloud sync fix (8 Apr)          |

---

## P3 — Quality / Scoring

| #   | Item                                     | Detail                                                                                                                                                                                                                                                                                                    | Source                          |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 3.1 | **Retest tier-changed platforms**        | Platforms that changed tiers during 26 Mar audit need BQI retesting. Run `--all --mode builder --replicates 3`. Candidates: Fotor (→T1), BlueWillow (→T4), artguru/artistly/clipdrop (→T4), Playground (→T3), canva/pixlr/simplified/artbreeder/deepai (→T3), hotpot/jasper-art/microsoft-designer (→T4). | Chat: Platform consolidation    |
| 3.2 | **Update `trend-analysis.md`**           | Needs v6.0.0. Must reflect T3/T4 builder separation, 25 independent NL builders, per-platform scores, BQI batch results.                                                                                                                                                                                  | Multiple chats                  |
| 3.3 | **BQI Part 9: `--scorer` flag wiring**   | `claude-scorer.ts` deployed. `aggregation.ts` references `scorerMode`. But batch runner CLI flag is hardcoded to `gpt_only`. Needs modification to support `dual_on_flagged` and `dual_full`.                                                                                                             | Chat: Part 9 build (4 Apr)      |
| 3.4 | **Verify cron auth fix in production**   | Code now accepts `Authorization: Bearer <secret>`. Fix verified in src.zip. But crons had never executed successfully in production before this fix. Needs production verification.                                                                                                                       | Chat: Chat system build (6 Apr) |
| 3.5 | **Harmony pass — Artbreeder incomplete** | Adobe Firefly complete 93/100. 123RF complete 91/100. Artbreeder was in progress but session ended before completion. Builder file exists but harmony verification not signed off. Remaining platforms not started.                                                                                       | Chat: Harmony pass (Mar–Apr)    |
| 3.6 | **Weekly AI citation testing**           | Sentinel Cockpit built (artifact). Testing not started. Need 4+ weeks of manual citation scoring before Citation Velocity Index (Extra B) produces meaningful output. 25 minutes/week.                                                                                                                    | Chat: Sentinel build (9 Apr)    |

---

## P4 — UX Polish

| #   | Item                      | Detail                                                                                                                                            | Source                             |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 4.1 | **Drift hint word count** | Show "3 words changed — click Generate" using existing `driftChangeCount`. Not implemented — no reference to `driftChangeCount` in prompt-lab UI. | Chat: Prompt Lab redesign (27 Mar) |

---

## P5 — Pre-Launch

| #   | Item                         | Detail                                     | Source |
| --- | ---------------------------- | ------------------------------------------ | ------ |
| 5.1 | **Security audit**           | Full audit before public launch.           | Memory |
| 5.2 | **Stripe Pro setup**         | Payment integration for Pro Promagen tier. | Memory |
| 5.3 | **YouTube content strategy** | Plan content when product is shelf-ready.  | Memory |

---

## P6 — Stale Authority Docs

Major cleanup completed 9 April 2026: 14 docs deleted, 5 docs merged, 18 stale docs updated across 4 batches. Remaining items:

| #   | Doc                     | Status                                                                                                                                |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | **`saved-page.md`**     | Predates cloud sync (hook v3.0.2), `getSessionFromCookie()`, Option B `clearAll()` decision. Flagged in 9 Apr doc audit. Still stale. |
| 6.2 | **`trend-analysis.md`** | Needs v6.0.0 (same as 3.2). Was in stale doc list.                                                                                    |
| 6.3 | **`code-standard.md`**  | Updated 9 Apr (platform counts, gallery mode) but §6.0.2 grey text rule may still need enforced-standard alignment (see 2.12).        |

---

## P7 — Sentinel (AI Visibility Intelligence)

22 files built across Sessions 1–6. Phase 1 code complete. Outstanding deployment and configuration:

| #   | Item                                   | Detail                                                                                                                                                                                                | Status      |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 7.1 | **Deploy Sentinel to production**      | env.ts integration (2.13) + Neon migration (2.14) + vercel.json crons (2.15) + Resend API key. All code built, needs configuration and deploy.                                                        | Ready       |
| 7.2 | **Set up Resend account**              | Sign up at resend.com. Get API key. Verify promagen.com domain (3 DNS records: MX, TXT, DKIM). Free tier: 3,000 emails/month.                                                                         | Not started |
| 7.3 | **Sentinel Phase 2 — GA4 integration** | `ga4-client.ts` and `canary.ts` infrastructure built. Returns "not configured" until `GA4_PROPERTY_ID` and `GA4_SERVICE_ACCOUNT_JSON` env vars set. Needs GA4 Data API credentials (service account). | Infra ready |
| 7.4 | **Sentinel Phase 3 — Claude Analyst**  | Sends crawl + GA4 data to Anthropic API for AI-written analysis. Build only after Phase 2 proven reliable (2–3 weeks of Monday reports). Cost: ~$0.02–0.05/week.                                      | Future      |
| 7.5 | **GA4 dashboard config doc**           | `docs/authority/ga4-dashboard-config.md` — defines GA4 dashboard layout, custom dimensions, event catalogue alignment. Referenced in analytics build plan.                                            | Not started |

---

## P8 — SEO / GSC / AI Citation

| #   | Item                                  | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Source                          |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 8.1 | **GSC: retry /platforms and /guides** | Site verified (HTML file). Sitemap submitted. Homepage indexed. `/platforms/negative-prompts` crawled. `/platforms` and `/guides/prompt-formats` had transient live-test failures — need retry in GSC.                                                                                                                                                                                                                                                                                                                                                            | Chat: GSC setup (9 Apr)         |
| 8.2 | **Deploy llms.txt to production**     | Route built at `src/app/llms.txt/route.ts`. Scored by ChatGPT. Not yet deployed to production. Quick win — extract zip → push → verify at `https://promagen.com/llms.txt`.                                                                                                                                                                                                                                                                                                                                                                                        | Chat: GSC setup (9 Apr)         |
| 8.3 | **Homepage links to /platforms**      | No link from homepage to `/platforms` hub found in code. Authority pages need discovery path from the main product pages.                                                                                                                                                                                                                                                                                                                                                                                                                                         | Memory                          |
| 8.4 | **"Cite this page" button**           | Authority pages should have a copy-to-clipboard citation snippet. Not built — zero references to "cite" in `src/components/authority/`.                                                                                                                                                                                                                                                                                                                                                                                                                           | Memory (to-do.md notes)         |
| 8.5 | **About / E-E-A-T page**              | Only `/about/how-we-score` exists. No broader E-E-A-T page covering team, methodology philosophy, data sources. Strengthens AI citation trust signals.                                                                                                                                                                                                                                                                                                                                                                                                            | Memory                          |
| 8.6 | **Real GSC API indexing tracker**     | Replace the manual checklist tracker in `docs/authority/authority-pages-operations-guide.html` Section 11 (current version is just a click-to-cycle switch with no real data — "witch doctor" tracker). Build proper backend: Node script `scripts/check-indexing.mjs` using GSC API with OAuth, outputs `docs/authority/indexing-status.json`, HTML reads JSON and shows REAL Google indexing status, last crawl date, last crawl status. ~2-3 hours including Google Cloud project setup and OAuth credentials. **Until built, use GSC Pages report directly.** | Chat: Indexing tracker (10 Apr) |

---

## Deferred (Horizon)

Items explicitly parked. Not forgotten — deferred until dependencies are met.

| Item                                            | Depends On                                                     |
| ----------------------------------------------- | -------------------------------------------------------------- |
| Explore Drawer: all 4 tier badges               | Must ship before evolution-plan-v2 build ends                  |
| Explore Drawer: cascade relevance chip ordering | Must ship before evolution-plan-v2 build ends                  |
| BQI Option C (full per-platform scores)         | After BQI Parts 9–12 mature the scoring pipeline               |
| Skip Call 3 for CLIP groups                     | Pending decision (~2pt gain, 85→87, likely not worth API cost) |
| Syndication                                     | Post-launch                                                    |
| YouTube content strategy                        | When shelf-ready (same as 5.3)                                 |
| PDF charts                                      | Post-launch                                                    |
| `/api/platform-data` endpoint                   | Post-launch                                                    |
| Sentinel competitive shadow crawl               | Only if competitive intelligence becomes a decision factor     |
| llms.txt enhancements                           | After initial deploy + monitoring                              |
| Use-case deep-dives with BQI stats              | After Option C ships                                           |

---

_Cross-referenced against `src.zip`, project memory, and all chat history on 9 April 2026. Every item verified by grep/file inspection. No completed items. Items 2.10 (leaderboard-rail grey text) and P6 docs (14 deleted + 5 merged + 18 updated on 9 Apr) removed as completed._
