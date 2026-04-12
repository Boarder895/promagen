# Call 3 Baseline Run — Pre-Flight Checklist

**Purpose:** Everything you must verify **before** kicking off the full 41×10 baseline run, so a broken env, a typo, or a missing key doesn't waste budget halfway through.

**Run location:** All PowerShell commands run from `C:\Users\Proma\Projects\promagen\frontend\` unless marked otherwise.

**Time budget:** ~15 min pre-flight, then the run itself.

---

## 0. Ground truth check (2 min)

Confirm the zip you just dropped in is what's actually live.

```powershell
# In repo root
git status
git log -1 --oneline
```

**Good:** Working tree clean (or only expected diffs), last commit matches the Call 3 Phase 10 drop.
**Bad:** Unstaged changes you don't recognise → stop and reconcile before running.

---

## 1. Environment variables (2 min)

The batch runner needs OpenAI access. Confirm the key is loaded in **this** PowerShell session.

```powershell
# Print length only — never echo the key itself
if ($env:OPENAI_API_KEY) {
  "OPENAI_API_KEY present, length: $($env:OPENAI_API_KEY.Length)"
} else {
  "OPENAI_API_KEY missing"
}
```

**Good:** Length > 40.
**Bad:** Missing → `$env:OPENAI_API_KEY = "sk-..."` for this session only, or load from `.env.local`.

Also confirm the model is pinned:

```powershell
Select-String -Path "src\lib\optimise-prompts\*.ts","src\lib\call-3-harness\*.ts" -Pattern "gpt-5\.4-mini" | Select-Object -First 5
```

**Good:** Matches present. **Bad:** No matches → the runner may be pointing at a different model; check before proceeding.

---

## 2. Install + typecheck + tests (3 min)

No point running the batch if the repo doesn't even compile.

```powershell
# From frontend folder
pnpm install
pnpm run test:util
pnpm run typecheck
```

**Good:** Tests green, typecheck clean.
**Bad:** Any failure → fix before proceeding. A typecheck regression introduced in Phase 10 will silently poison scorer output.

> **Jargon:** *typecheck* = `tsc --noEmit`. Validates TypeScript types without building. Fast.

---

## 3. Verify the 10 phases are wired (2 min)

Quick sanity check that Phase 10 artifacts exist where the runner expects them.

```powershell
$required = @(
  "src\data\platform-dna\profiles.json",
  "src\data\platform-dna\hallucination-map.json",
  "src\data\platform-dna\types.ts",
  "src\data\scoring\test-scenes.json",
  "src\lib\optimise-prompts\aps-gate.ts",
  "src\lib\optimise-prompts\retry-protocol.ts",
  "src\lib\call-3-transforms\attention-sequence.ts",
  "src\lib\call-3-transforms\semantic-compress.ts",
  "src\lib\call-3-transforms\index.ts",
  "src\lib\call-3-transforms\negative-intelligence.ts",
  "src\lib\call-3-harness\triage.ts",
  "src\lib\call-3-harness\builder-refinement.ts",
  "src\lib\call-3-harness\mechanical-scorer.ts",
  "src\lib\call-3-harness\types.ts"
)
$missing = $required | Where-Object { -not (Test-Path $_) }
if ($missing.Count -eq 0) { "All 14 required files present" } else { "MISSING:"; $missing }
```

**Good:** `All 14 required files present`. **Bad:** Missing anything → stop.

---

## 4. Verify the batch runner exists (1 min)

> **Assumption flagged:** The handoff brief states the runner lives at `scripts/builder-quality-run.ts`. It is **outside** `src/` and therefore not in the `src.zip` I verified. Confirm it exists in your working copy before running.

```powershell
Test-Path "scripts\builder-quality-run.ts"
Get-ChildItem "scripts" -Filter "builder-quality*.ts" -ErrorAction SilentlyContinue
```

**Good:** Returns `True` and shows the file.
**Bad:** File not found → stop. Find the runner or we're dead in the water; nothing in this kit assumes we can spin one up in this session.

Then check what script name pnpm exposes it under:

```powershell
Select-String -Path "package.json" -Pattern "builder-quality|bqi|baseline" -SimpleMatch
```

Write down the script name it finds (e.g. `pnpm run bqi:batch`). You'll use it in step 7.

---

## 5. Dry-run on ONE platform (5 min)

**Do not run the full 41-platform batch yet.** A single-platform dry run costs pennies and catches 90% of what would kill a full run.

Pick a cheap, well-understood platform for the dry run. Suggested: **Midjourney** (CLIP-style, fast) **or** **OpenAI** (NL, short prompts).

```powershell
# Example — adapt to whatever your runner's actual CLI surface is.
# If the runner supports --platform filtering:
pnpm run <batch-script-name> -- --platform midjourney --scenes all

# If not, temporarily set PLATFORM_FILTER env var if the runner reads one:
$env:PLATFORM_FILTER = "midjourney"
pnpm run <batch-script-name>
Remove-Item Env:\PLATFORM_FILTER
```

> **Don't know the flag surface?** Grep the runner: `Select-String -Path scripts\builder-quality-run.ts -Pattern "argv|process\.env|filter"`.

**What "good" looks like for the dry run:**
- Runner starts, prints config (model, temperature, scene count)
- Per-scene log line for each of the 10 scenes (no silent skips)
- Finishes without an OpenAI error or rate-limit
- Writes at least **one** output file (scores JSON or triage markdown)
- Triage markdown, if generated, shows a bucket (🟢/🟡/🔴) for the platform
- Mechanical scorer output, if generated, shows rule PASS/FAIL counts

**What "bad" looks like (stop immediately):**
- Hangs with no log output for >60s → the OpenAI call is blocked or retrying silently
- Runner prints "using model gpt-4…" or anything other than `gpt-5.4-mini`
- Anchors come through as `undefined` → scorer is mis-wired
- Every scene returns the same score → scorer is not actually running
- Writes to a path outside `reports/` or `out/` — flag and stop

---

## 6. Budget + time estimate (1 min)

**Order-of-magnitude** only — your dry run will give you a real number for Step 7.

- 41 platforms × 10 scenes = **410 optimisations**
- Each optimisation = 1 GPT call (Call 3) + deterministic scoring (free)
- At gpt-5.4-mini pricing, each call is cheap — low pennies to a few tens of pence per call depending on prompt length
- **Rough envelope:** £1–£8 for the full run. Treat this as a ceiling check, not a quote.

**Measure, don't guess:** After your dry run completes, multiply the observed cost × 41. That's your real budget. If the extrapolation exceeds your comfort limit, shrink the scene set to 5 and re-estimate.

**Wall-clock estimate:** 410 sequential calls at ~3–8 s each = **20–55 minutes** end-to-end if the runner is sequential. If parallel (check `Promise.all` in runner), much less. **Bad sign:** runner appears to take > 2 hrs → rate limit or infinite retry loop.

---

## 7. Run the full baseline

Only after Steps 0–6 are green.

```powershell
# Clear stale build artefacts (Martin standard)
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# Kick the run
pnpm run <batch-script-name>
```

**Redirect output to a log file** — you'll want it when things go sideways:

```powershell
pnpm run <batch-script-name> 2>&1 | Tee-Object -FilePath "reports\baseline-run-$(Get-Date -Format 'yyyyMMdd-HHmm').log"
```

---

## 8. Expected output files

The runner (per Phase 6/10 code) should emit at least:

| File | Where | What it is |
|---|---|---|
| Triage markdown | `reports/harmony-pass-2-triage.md` (or runner-configured path) | Per-platform 🟢/🟡/🔴 table + per-scene regression warnings. **Primary artefact.** |
| Per-platform scores JSON | `reports/` or `out/` | Raw scores per (platform, scene) — needed for mechanical scorer + ChatGPT review |
| Mechanical scorer output | `reports/mechanical-scorer.*` | Rule pass/fail counts (R01–R10) |
| Run log | whatever Tee-Object captured | Full stdout/stderr |

**If you don't see a triage markdown after the run finishes → something is wrong.** Triage is the whole point of the exercise.

---

## 9. Rollback plan

If the run dies or produces garbage halfway through:

1. **Do not panic-delete outputs.** Move the partial run aside, don't bin it:
   ```powershell
   if (Test-Path "reports\harmony-pass-2-triage.md") {
     Move-Item "reports\harmony-pass-2-triage.md" "reports\harmony-pass-2-triage.PARTIAL-$(Get-Date -Format 'HHmm').md"
   }
   ```
2. Grep the log for the first non-zero exit / `Error:` / `429` / `timeout`:
   ```powershell
   Select-String -Path "reports\baseline-run-*.log" -Pattern "error|429|timeout|ECONN" -SimpleMatch
   ```
3. Triage: **platform problem** (one platform always fails — skip it, rerun the rest) vs **pipeline problem** (random failures, rate-limits, network). See the Result-Reading Guide §6 for the distinction.
4. **Never** manually edit the triage markdown to "fix" a failed row. If the data is wrong, the triage is wrong — rerun that platform alone.
5. Git state: `git status` — confirm nothing in `src/` was touched during the run. The runner should be read-only on source. If it's writing there, **stop**.

---

## 10. Sign-off before you walk away from the terminal

Tick every box before you call it done:

- [ ] Typecheck + tests were green pre-run
- [ ] Model confirmed as `gpt-5.4-mini`
- [ ] Dry run on one platform succeeded and produced expected outputs
- [ ] Full run kicked with stdout captured to log
- [ ] At least the triage markdown file exists after the run
- [ ] No errors in the log's final 50 lines
- [ ] Git working tree still clean under `src/`
- [ ] You know where the outputs are so you can find them tomorrow

Now go read `02-result-reading-guide.md`.
