# Call 3 Baseline Measurement Kit

Three documents. Read in order.

1. **`01-preflight-checklist.md`** — What to verify before kicking the run. Env vars, typecheck, dry run on one platform, budget estimate, rollback plan. ~15 min of work before the full run.
2. **`02-result-reading-guide.md`** — How to read the triage markdown, mechanical scorer output, and per-scene regression warnings. How to tell noise from a real regression. How to tell a platform problem from a pipeline problem. What to screenshot for ChatGPT review.
3. **`03-decision-matrix.md`** — `IF measured X THEN build Y` table. Maps real outcomes to the 8 scored extras. Most rows say "don't build" — that's deliberate.

## Phase verification summary

All 10 Call 3 build phases verified present in the `src.zip` you uploaded:

| Phase | File | ✓ |
|---|---|---|
| 1 | `src/data/platform-dna/profiles.json` (41 entries) | ✓ |
| 2 | `src/lib/optimise-prompts/aps-gate.ts` | ✓ |
| 3 | `src/lib/call-3-transforms/attention-sequence.ts` | ✓ |
| 4 | `src/lib/call-3-transforms/semantic-compress.ts` | ✓ |
| 5 | `src/lib/call-3-transforms/index.ts` + 12 transform files | ✓ |
| 6 | `src/lib/call-3-harness/triage.ts` + `test-scenes.json` (10 scenes) | ✓ |
| 7 | `src/lib/call-3-harness/builder-refinement.ts` | ✓ |
| 8 | `src/lib/optimise-prompts/retry-protocol.ts` | ✓ |
| 9 | `src/lib/call-3-transforms/negative-intelligence.ts` + `hallucination-map.json` | ✓ |
| 10 | `src/lib/call-3-harness/types.ts` + `mechanical-scorer.ts` (R01–R10 present) | ✓ |

## Flagged assumptions (not invented)

- `profiles.json` has **41** entries, not 40. One may be a template/meta record.
- `scripts/builder-quality-run.ts` (BQI batch runner) lives **outside** `src/` and is **not** in `src.zip`. The preflight checklist includes a step to confirm it exists in your working copy before the run.
- Scene keys in `test-scenes.json` use `outdoor_dramatic` and **match** `hallucination-map.json`. The mismatch noted in the handoff brief is between those two files and the architecture doc's `outdoor_drama` — code is internally consistent; the architecture doc is the outlier.
- The `abstract_stylised` category has only 1 scene in the 10-scene set. Category-level conclusions for that bucket will be unreliable from this baseline — noted in the reading guide.

## What this kit does not do

- Does not run the baseline. That's your job — Claude can't execute `pnpm run` from here.
- Does not build any of the 8 scored extras. None of them are justified until the measurement is in.
- Does not modify any code. Zero edits to `src/`.

**Existing features preserved: Yes** — no code was changed.
