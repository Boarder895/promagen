# Builder Quality Intelligence — Run Log

**Purpose:** Quick human reference for batch run IDs and key findings. The real data lives in Postgres (`builder_quality_runs` + `builder_quality_results`). Part 8 admin dashboard will be the proper browsing tool.

**Neon console queries:**

```sql
-- All runs (newest first)
SELECT run_id, status, mode, scope, replicate_count, total_completed, mean_gpt_score, created_at
FROM builder_quality_runs ORDER BY created_at DESC;

-- Results for a specific run (lowest scores first)
SELECT platform_id, scene_id, gpt_score, anchors_preserved, anchors_dropped, critical_anchors_dropped
FROM builder_quality_results WHERE run_id = '<RUN_ID>' AND status = 'complete'
ORDER BY gpt_score ASC LIMIT 20;

-- Worst platforms by mean score across a run
SELECT platform_id, AVG(gpt_score)::int AS mean_score, SUM(critical_anchors_dropped) AS crit_drops
FROM builder_quality_results WHERE run_id = '<RUN_ID>' AND status = 'complete'
GROUP BY platform_id ORDER BY mean_score ASC LIMIT 10;
```

---

## Runs

| #   | Run ID                | Date       | Scope    | Replicates | Results | Mean  | Range | Baseline              | Notes                                                                       |
| --- | --------------------- | ---------- | -------- | ---------- | ------- | ----- | ----- | --------------------- | --------------------------------------------------------------------------- |
| 1   | `bqr-mnjhzihx-z5rilk` | 3 Apr 2026 | all (40) | 1          | 319/320 | 81.97 | 51–97 | —                     | First clean full batch. 1 error (imagine-meta scene-07, transient GPT 502). |
| 2   | `bqr-mnjjnqlq-0mqhif` | 3 Apr 2026 | lexica   | 3          | 24/24   | 81.50 | 53–97 | —                     | First 3-replicate decision-grade run. Scene-06 consistently weak (53-55).   |
| 3   | `bqr-mnjjq5qn-evliuy` | 3 Apr 2026 | all (40) | 1          | partial | —     | —     | `bqr-mnjhzihx-z5rilk` | Second full batch with baseline comparison. Cut short manually.             |

---

## Key Findings (3 Apr 2026)

**Weakest scenes across all platforms:**

- **Scene 06 (negative trigger):** Mean ~71. Critical negatives ("no smoke", "no people", "no animals") dropped by nearly every platform. This is a known builder weakness — most platforms don't handle explicit negatives well in the positive prompt.
- **Scene 08 (French New Wave):** Mean ~72. Camera models (Kodak Vision3 500T, Arriflex 35BL) and film references (French New Wave) consistently flattened. 2-4 critical anchors dropped across all platforms. Exactly what the system was designed to catch.
- **Scene 07 (compression stress):** Mean ~68. Expected — hardest scene at ~1,900 chars. Builders sacrifice detail under extreme compression.

**Strongest scenes:**

- **Scene 04 (colour saturation):** Mean ~95. All 10 colour anchors preserved everywhere. Builders handle colour well.
- **Scene 02 (cyberpunk courier):** Mean ~89. Standard benchmark, consistent.

**T1 (CLIP) vs T3/T4 (NL/Plain) split:**

- T1 platforms score higher on Scene 08 (film terminology survives in CLIP weights)
- T4 platforms score lowest on Scene 08 (plain language strips technical references)
- Negative handling weak across all tiers

---

## How to update this file

After each batch run, add a row to the table and note any new findings. The dashboard (Part 8) will replace this for day-to-day browsing, but this file stays as the permanent human-readable audit trail.
