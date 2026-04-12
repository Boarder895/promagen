# Call 3 Baseline Run — Decision Matrix

**Purpose:** One page. Map measured outcomes to concrete build decisions. Each row is `IF <measured condition> THEN <build / don't build / investigate>`.

**Rule of engagement:** Do not build any extra until a row in this matrix is triggered by real data from the baseline run. "I think it's probably true" is not a trigger.

**The 8 scored extras (for reference only — do not build unprompted):**

| # | Extra | Score | Effort |
|---|---|---|---|
| 1 | Quality-position cap fix (Trafalgar) | 95 | Half |
| 2 | Harmony compliance test suite | 95 | 1 |
| 3 | Transform-level APS rollback | 94 | 1 |
| 4 | Route orchestration extraction | 93 | 1 |
| 5 | Position-aware AVIS placement | 92 | 1 |
| 6 | Structured transform diagnostics | 91 | Half |
| 7 | Scene-weighted triage | 91 | Half |
| 8 | Category-level triage summaries | 91 | Half |

**Known supersets:** #5 supersets #1 and #3. #4 pairs with #6. #7 pairs with #8.

---

## A. Triage bucket distribution

| # | IF the measured result is… | THEN the action is… | Which extra |
|---|---|---|---|
| A1 | > 80% of platforms in a single bucket (any) | **Investigate thresholds.** Triage is not discriminating. Capture distribution and send to ChatGPT before touching anything else. | None yet |
| A2 | Even spread across 🟢/🟡/🔴 with clear gaps | Proceed to read the per-scene + rule sections. Matrix is trustworthy. | None |
| A3 | > 10 platforms 🔴 Red | **Do not** start building extras. This is a pipeline-level regression. Go to §D first. | None until §D passes |
| A4 | ≥ 15 platforms 🟢 Green with clean per-scene data | Consider starting Phase 11 harmony pass on Green platforms. Refine builders per Phase 7 tooling. | None — proceed to harmony pass |

---

## B. Per-scene regressions (the Trafalgar question)

| # | IF the measured result is… | THEN the action is… | Which extra |
|---|---|---|---|
| B1 | ≥ 5 platforms show quality-position-style regression (subject pushed out by quality front-loading) | Build **Extra #5 (Position-aware AVIS)**. It supersets #1 and #3, so you get all three for one session. | **#5** |
| B2 | 1–4 platforms show the same pattern, mostly outdoor_dramatic | Build **Extra #1 (Quality-position cap fix)** — cheap, targeted, don't over-engineer. | **#1** |
| B3 | Regressions cluster on **one** platform only | **Do not** build a transform-level fix. Fix the platform's DNA profile instead. | None |
| B4 | Regressions spread randomly with no scene clustering | It's noise. Flag for ChatGPT review. Do not build. | None |
| B5 | Outdoor_dramatic scenes dominate the regression list (≥ 60% of flagged lines) AND indoor_character looks fine | Build **Extras #7 + #8 together (scene-weighted triage + category summaries)**. You need category visibility before any further transform tuning. | **#7 + #8** |
| B6 | abstract_stylised regresses | **Do not act on 1 scene.** Note it, rerun next baseline with more stylised scenes, decide then. | None — insufficient data |

---

## C. Mechanical scorer rules (R01–R10)

| # | IF the measured result is… | THEN the action is… | Which extra |
|---|---|---|---|
| C1 | R01 OUTPUT_NOT_EMPTY fails on any platform | **Stop everything.** This is a wiring bug, not a quality issue. Fix and re-run baseline. | None (fix bug) |
| C2 | R02 CEILING_COMPLIANCE fails on any platform | The char gate is broken. Fix before building anything. | None (fix bug) |
| C3 | R03 NO_CATASTROPHIC_SHORTENING fires on > 10 platforms | Confirms the unsolved GPT shortening problem is live. Solve **the `idealMax × 2.5` ceiling issue** (already on the open items list) before building any extra. | None — fix upstream first |
| C4 | R06 NO_INVENTED_CONTENT never fires | The rule is too narrow. **Deprioritise** negative-engine expansion work. Flag R06 for redesign. | Cut work, not add |
| C5 | R09 RETRY_EFFECTIVENESS fires > 30% of the time but recovers < 20% | Retry protocol is wasteful. **Disable retry on the measured wasteful platforms**. Do not build more retry tooling. | Cut work, not add |
| C6 | R09 fires < 10% of the time | Retry is barely running. Either (a) platforms don't need it or (b) the trigger is too strict. Log and review; no build yet. | None |
| C7 | R10 TRANSFORM_ACTIVITY fails on most CLIP platforms | CLIP transforms are dead. Supports the pending decision: **skip Call 3 entirely for CLIP groups**. Bring to ChatGPT with data. | None (cut scope) |
| C8 | R10 fails on > 5 platforms total | Some transforms are ghosts. Build **Extra #6 (Structured transform diagnostics)** so you can see which transform is dead and why. Pairs with #4. | **#6** (+ **#4** if route is also hard to attribute) |

---

## D. Pipeline / systemic failure

| # | IF the measured result is… | THEN the action is… | Which extra |
|---|---|---|---|
| D1 | Global mean baseline differs > 5 pts from last harmony pass | Call 2 or scorer drifted. **Do not trust any other row in this matrix.** Fix baseline, rerun. | None |
| D2 | route.ts made attribution ambiguous during debugging (you had to read 300 lines to find where a value came from) | Build **Extra #4 (Route orchestration extraction)**. Pairs naturally with #6. | **#4** (+ **#6**) |
| D3 | Harmony pass doc shows compliance drift from previous releases | Build **Extra #2 (Harmony compliance test suite)**. This is standalone safety — independent of any measurement result, but upgraded in priority if drift is visible. | **#2** |
| D4 | Runner produced inconsistent counts across retries (same config → different output) | **Stop.** Non-deterministic runner is unsellable. Fix determinism before interpreting any data. | None (fix runner) |

---

## E. When to build Extra #2 regardless

Extra #2 (Harmony compliance test suite) is flagged in the scored list as **standalone safety** — it has no overlap with any other extra. The baseline measurement cannot disprove its value; it only determines urgency.

| # | IF… | THEN Extra #2 priority is… |
|---|---|---|
| E1 | Harmony pass scores drift downward between runs | **High** — build next session |
| E2 | Harmony scores stable | **Medium** — build after any measurement-justified extras |
| E3 | You're about to ship a major Call 3 change | **High** — build first |

---

## F. The "don't build" column

These outcomes mean **do not build** and do not revisit until next baseline:

- Clean triage, roughly even bucket spread, per-scene regressions noise-only, R01+R02 at 100%, R10 firing on > 80% → **system is healthy, go run harmony pass on Green platforms.**
- Total gain positive but small (< 2 pts global mean) AND no regressions → Call 3 is paying its cost barely. **Tune builder refinement, not the transform chain.**
- Amber dominates and no strong scene pattern → **test deterministic alternative on Amber platforms** (Phase 6 triage already instructs this). Do not build new extras.

---

## G. Collapsed build plan (if everything triggers)

If the baseline somehow triggers every row, here's the minimum session count — already collapsed by the known overlap structure:

| Session | Builds | Triggered by |
|---|---|---|
| 1 | Extra #2 alone | E1 or E3 |
| 2 | Extra #5 alone (supersets #1 + #3) | B1 |
| 3 | Extras #4 + #6 together | C8 and/or D2 |
| 4 | Extras #7 + #8 together | B5 |

**Four sessions, not eight.** And the baseline will almost certainly not trigger all four — that's the point of measuring.

---

## H. One rule above all others

> **If the baseline reveals the pipeline is broken (§C1, §C2, §D1, §D4), every other row in this matrix is suspended.** Fix the plumbing, rerun the baseline, re-read this matrix against the new data.

Do not build quality extras on top of a broken foundation. REME standards apply.
