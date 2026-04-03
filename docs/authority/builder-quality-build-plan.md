# Builder Quality Intelligence — Build Plan

**Version:** 1.0.0  
**Date:** 3 April 2026  
**Authority:** `docs/authority/builder-quality-intelligence.md` v2.5.0 (FINAL)  
**ChatGPT review:** 97/100 — signed off, no further review required.

---

## Overview

6 core parts. Each part is a self-contained delivery with its own zip, verification steps, and "done" criteria. Parts build on each other — deliver in order.

**Total estimated effort:** 13–16 hours for Parts 1–6 (core system).  
**Parts 7–12** (replicates, dashboard, dual-model, rerun, sampling, patch suggestion) ship incrementally after core proves stable.

---

## Part 1 — Test Scene Library

**What:** JSON files containing all 10 test scenes with human text, expected anchors (with severity), stress targets, and expected categories.

**New files:**

| File | Purpose |
|------|---------|
| `src/data/scoring/test-scenes.json` | 8 core scenes |
| `src/data/scoring/holdout-scenes.json` | 2 holdout scenes |
| `src/data/scoring/types.ts` | TypeScript interfaces (TestScene, AnchorSpec, AnchorAuditEntry) |

**Modifies:** Nothing.  
**Deletes:** Nothing.  
**Existing features preserved:** Yes.

**Verification:**
```powershell
# From frontend/
npx tsc --noEmit
```
TypeScript compiles. JSON files importable. No runtime test — data only.

**Done when:**
- [ ] 8 core scenes in `test-scenes.json` with all anchor tables from the authority doc
- [ ] 2 holdout scenes in `holdout-scenes.json`
- [ ] Types file compiles cleanly
- [ ] `holdout: true` set on scenes 9 and 10

---

## Part 2 — Kill User-Facing Score

**What:** Remove the Score section from the right rail. No score visible to the user. The scoring route stays deployed (batch runner uses it later).

**Modifies:**

| File | Change |
|------|--------|
| `src/components/prompt-lab/pipeline-xray.tsx` | Remove `XRayScore` import, remove the Score `<SectionWire />` + `<XRayScore />` block, remove `scoreResult`/`isScoring`/`scoreError` from props interface |
| `src/app/studio/playground/playground-page-client.tsx` | Remove `usePromptScore` import + hook call, remove `prevOptimiseRef` + auto-fire `useEffect`, remove `scoreResult`/`isScoring`/`scoreError` props from `<PipelineXRay />` |

**Does NOT delete:**

| File | Reason |
|------|--------|
| `src/hooks/use-prompt-score.ts` | Batch runner may reuse the types. Keep for now, delete later if unused. |
| `src/components/prompt-lab/xray-score.tsx` | Keep for reference. Delete once batch runner has its own scoring display. |
| `src/app/api/score-prompt/route.ts` | Batch runner calls this. Stays deployed. |

**Existing features preserved:** Yes — Decoder, Switchboard, Alignment all untouched.

**Verification:**
```powershell
Remove-Item -Recurse -Force .next
npm run dev
```
1. Navigate to `/studio/playground`
2. Type a description, generate, select platform, optimise
3. Right rail shows Decoder → Switchboard → Alignment. **No "§ The Score" section anywhere.**
4. No console errors
5. `npx tsc --noEmit` passes

**Done when:**
- [ ] No score visible in the right rail under any circumstance
- [ ] Decoder, Switchboard, Alignment still function identically
- [ ] No TypeScript errors
- [ ] No console errors on the playground page

---

## Part 3 — Database Schema + Route Hardening

**What:** Create the two Postgres tables and add server-side API key protection to the scoring route.

**New files:**

| File | Purpose |
|------|---------|
| `src/lib/builder-quality/database.ts` | `CREATE TABLE IF NOT EXISTS` for `builder_quality_runs` + `builder_quality_results`, query helpers, health check |

**Modifies:**

| File | Change |
|------|--------|
| `src/app/api/score-prompt/route.ts` | Add `X-Builder-Quality-Key` header check. Requests without valid key get 401. |
| `src/lib/env.ts` | Add `BUILDER_QUALITY_KEY` to env schema |
| `.env.local` (not in zip — manual) | Add `BUILDER_QUALITY_KEY=<generate-a-uuid>` |

**Existing features preserved:** Yes.

**Verification:**
```powershell
# 1. TypeScript check
npx tsc --noEmit

# 2. Table creation (dev server must be running with DATABASE_URL set)
# Tables auto-create on first query via ensureTablesExist()

# 3. Route hardening test — should return 401
curl -X POST http://localhost:3000/api/score-prompt \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# 4. Route with valid key — should return 400 (invalid body, but auth passes)
curl -X POST http://localhost:3000/api/score-prompt \
  -H "Content-Type: application/json" \
  -H "X-Builder-Quality-Key: <your-key>" \
  -d '{"test": true}'
```

**Done when:**
- [ ] Both tables exist in Postgres (check via `psql` or Neon console)
- [ ] Route returns 401 without key
- [ ] Route returns 400 (schema validation error) with valid key + bad body
- [ ] TypeScript compiles

---

## Part 4 — Reframe Scoring System Prompt

**What:** Rewrite the scoring system prompt from user-facing directives to builder diagnostic notes. Add anchor audit with three-level classification and severity. Implement §3.2 matching policy.

**Modifies:**

| File | Change |
|------|--------|
| `src/app/api/score-prompt/route.ts` | Rewrite `buildSystemPrompt()` — diagnostic voice, anchor audit instructions, §3.2 sub-rules in prompt. Rewrite `buildUserMessage()` — include expected anchors with severity. Update `ScoreResponseSchema` — add `anchorAudit` array. Update calibration examples for diagnostic framing. |

**New files:**

| File | Purpose |
|------|---------|
| `src/lib/builder-quality/anchor-audit.ts` | Client-side anchor matching engine — `exact`/`approximate`/`dropped` classification per §3.2 policy. Used by batch runner to validate GPT's anchor audit independently. |

**Existing features preserved:** Yes — route contract changes (new response fields) but batch runner is the only consumer.

**Verification:**
Test in OpenAI Playground (gpt-5.4-mini, json_object, temp 0.2, medium reasoning):
1. Fox shrine scene → anchor audit should show `torii gates: exact`, `falling: exact or approximate`
2. French New Wave scene → `Kodak Vision3 500T` must be `exact` or `dropped`, never `approximate`
3. Negative trigger scene → `no smoke` audit must follow Sub-rule C
4. Directives use diagnostic voice ("Call 3 dropped..."), not user voice ("Restore...")

**Done when:**
- [ ] System prompt uses diagnostic framing throughout
- [ ] Anchor audit returns three-level status with severity
- [ ] Calibration examples rewritten for builder diagnostics
- [ ] Playground tests produce sensible results on 4+ test scenes
- [ ] Client-side anchor matching engine passes unit tests for all 5 sub-rules

---

## Part 5 — Frozen Snapshot Generator

**What:** A script that runs all 8 core scenes through Call 2 once per tier, captures the assembled prompts, and saves them as frozen snapshots.

**New files:**

| File | Purpose |
|------|---------|
| `scripts/generate-snapshots.ts` | Runs Call 2 for each scene × tier, saves to JSON |
| `src/data/scoring/frozen-snapshots.json` | Generated output — committed to repo |
| `src/data/scoring/holdout-snapshots.json` | Generated output for holdout scenes — committed to repo |

**Modifies:** Nothing.  
**Existing features preserved:** Yes.

**Execution:**
```powershell
# From frontend/ — dev server must be running
npx tsx scripts/generate-snapshots.ts
```

**Verification:**
1. `frozen-snapshots.json` contains 8 scenes × 4 tiers = 32 entries
2. `holdout-snapshots.json` contains 2 scenes × 4 tiers = 8 entries
3. Each entry has `sceneId`, `tier`, `call2Version`, `assembledPrompt`, `snapshotHash`, `createdAt`
4. Assembled prompts look correct (not empty, not error messages)

**Done when:**
- [ ] Both JSON files generated with correct entry counts
- [ ] Snapshot hashes are deterministic (same content = same hash)
- [ ] Files committed to repo

---

## Part 6 — Batch Runner

**What:** The core script that runs Call 3 → Score for each platform, stores results in Postgres, and reports summary.

**New files:**

| File | Purpose |
|------|---------|
| `scripts/builder-quality-run.ts` | Main batch runner script |
| `src/lib/builder-quality/runner.ts` | Core runner logic (separated from CLI for testability) |
| `src/lib/builder-quality/hash.ts` | MD5 helpers for builder file hash, snapshot hash |

**Modifies:**

| File | Change |
|------|--------|
| `src/app/api/score-prompt/route.ts` | May need minor adjustments based on Part 4 testing |

**Existing features preserved:** Yes.

**Execution:**
```powershell
# Single platform diagnostic (1 replicate, GPT-only)
npx tsx scripts/builder-quality-run.ts --platform imagine-meta --mode builder --scorer gpt_only

# Full batch (all 40 platforms)
npx tsx scripts/builder-quality-run.ts --all --mode builder --scorer gpt_only

# Decision-grade (3 replicates)
npx tsx scripts/builder-quality-run.ts --platform imagine-meta --mode builder --replicates 3

# Include holdouts
npx tsx scripts/builder-quality-run.ts --all --mode builder --holdout
```

**Verification:**
1. Single platform run completes with `status: 'complete'`
2. Results visible in `builder_quality_results` table (check via Neon console)
3. Run visible in `builder_quality_runs` table with correct summary stats
4. Anchor audit populated with `exact`/`approximate`/`dropped` entries
5. `builder_version` is an MD5 hash, not free text
6. `post_processing_changed` correctly detected
7. Error handling: kill the dev server mid-run → run shows `partial` status

**Done when:**
- [ ] Single-platform run completes end-to-end
- [ ] Full 40-platform run completes (320 results for 8 core scenes)
- [ ] Results in Postgres with all columns populated
- [ ] Anchor audit classifications follow §3.2 policy
- [ ] Builder version is file hash
- [ ] Post-processing delta captured
- [ ] Error handling works (partial runs, individual failures)
- [ ] Console output shows clear progress and summary

---

## Parts 7–12 (Incremental — after core proves stable)

| Part | What | When |
|------|------|------|
| **7** | Replicate support (3 runs, mean/min/max/stddev, decision thresholds) | After 2-3 successful full batch runs |
| **8** | Admin dashboard (`/admin/builder-quality`) — read-only views | After Part 7, when there's data to display |
| **9** | Dual-model scoring (Claude via Anthropic API, switchable modes) | After dashboard, so results are visible |
| **10** | Rerun/resume mechanics (`--rerun`, `--resume` flags) | After first batch run surfaces real errors |
| **11** | User sampling (Community Pulse → periodic scoring) | After dashboard + 1 month of batch data |
| **12** | Human-assisted patch suggestion | After 50+ results per platform |

These don't need detailed plans yet. Each gets its own plan when the previous part is stable.

---

## File Summary (Parts 1–6)

### New files (10):

| File | Part |
|------|------|
| `src/data/scoring/test-scenes.json` | 1 |
| `src/data/scoring/holdout-scenes.json` | 1 |
| `src/data/scoring/types.ts` | 1 |
| `src/lib/builder-quality/database.ts` | 3 |
| `src/lib/builder-quality/anchor-audit.ts` | 4 |
| `src/lib/builder-quality/runner.ts` | 6 |
| `src/lib/builder-quality/hash.ts` | 6 |
| `src/data/scoring/frozen-snapshots.json` | 5 (generated) |
| `src/data/scoring/holdout-snapshots.json` | 5 (generated) |
| `scripts/builder-quality-run.ts` | 6 |

### Modified files (3):

| File | Part | Change |
|------|------|--------|
| `src/components/prompt-lab/pipeline-xray.tsx` | 2 | Remove Score section |
| `src/app/studio/playground/playground-page-client.tsx` | 2 | Remove scoring hook + auto-fire |
| `src/app/api/score-prompt/route.ts` | 3, 4 | Route hardening + system prompt reframe |

### Modified (env only, not in zip):

| File | Part |
|------|------|
| `src/lib/env.ts` | 3 |
| `.env.local` | 3 (manual) |

### Kept but unused after Part 2:

| File | Status |
|------|--------|
| `src/hooks/use-prompt-score.ts` | Keep — types may be reused. Delete later if not. |
| `src/components/prompt-lab/xray-score.tsx` | Keep for reference. Delete when batch runner has own display. |

---

## Delivery Sequence

Each part is delivered as a single zip with repo-matching folder structure. Martin drags into `C:\Users\Proma\Projects\promagen\frontend\`, clears `.next`, restarts dev server, verifies.

| Delivery | Contains | Approx effort |
|----------|----------|---------------|
| **Delivery 1** | Part 1 (test scenes) + Part 2 (kill user-facing score) | 2 hours |
| **Delivery 2** | Part 3 (database + route hardening) | 2 hours |
| **Delivery 3** | Part 4 (scoring prompt reframe + anchor audit engine) | 2–3 hours |
| **Delivery 4** | Part 5 (frozen snapshot generator) | 2 hours |
| **Delivery 5** | Part 6 (batch runner) | 5–7 hours |

Parts 1+2 ship together because neither has dependencies and both are small. Parts 3–6 ship individually because each needs verification before the next builds on it.

---

## What Martin Does Between Deliveries

| After | Martin's job |
|-------|-------------|
| Delivery 1 | Verify score is gone from right rail. Check JSON files look correct. |
| Delivery 2 | Add `BUILDER_QUALITY_KEY` to `.env.local` and Vercel env vars. Verify tables in Neon console. Test 401 on route without key. |
| Delivery 3 | Run 4 test scenes through OpenAI Playground to validate diagnostic framing and anchor audit. Verify Sub-rules A–E are respected. |
| Delivery 4 | Run snapshot generator. Eyeball assembled prompts — do they look right? Commit JSONs to repo. |
| Delivery 5 | Run single-platform batch. Check results in Neon. Run full batch. Celebrate or report bugs. |

---

## Risk Items

| Risk | Mitigation |
|------|-----------|
| Approximate matching is hard to implement consistently | Unit tests for all 5 sub-rules with concrete examples from §3.2. Test before integrating with batch runner. |
| Raw vs post-processed capture may need route surgery | Check in Part 4 whether compliance gates can expose pre-gate output cleanly. If invasive, defer to Part 7. |
| Dashboard effort (Part 8) will be larger than expected | Not blocking core. Dashboard ships when core data is flowing. |
| Frozen snapshots can go stale | Freshness warning in batch runner console output. |
