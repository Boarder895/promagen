# Promagen To-Do

**Created:** 27 March 2026  
**Owner:** Martin Yarnold  
**Source:** Compiled from all Claude project chats + memory  
**Rule:** Items are only removed when deployed and verified. Tick ✅ when done, don't delete.

---

## Priority 1 — Bugs & Broken Things

| #   | Item                                                                                                                                                                                                                                                                                                                                                               | Source                                             | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------ |
| 1.1 | **Negative prompts invisible in UI** — `aiOptimiseResult.negative` is returned by Call 3 API and stored in the hook but never rendered anywhere in the Prompt Lab. All Dynamic Negative Intelligence output is currently invisible to the user. Platforms with negative support (Recraft, NovelAI, Midjourney, SD CLIP groups) generate negatives that go nowhere. | Chat: Optimizing top 6 providers (27 Mar)          | ⬜     |
| 1.2 | **25 orphaned test files** — 12 in `__tests__/` and 11 in `__tests__/admin/` are not matched by any Jest project pattern. ~290 test cases providing zero CI protection. Fix: add patterns to `jest.config.cjs` app group. See `test.md` §3 for exact patterns.                                                                                                     | Chat: Text image prompt tier assessment (25 Mar)   | ⬜     |
| 1.3 | **3 dead v4 files** — `assessment-box.tsx`, `category-decision.tsx`, `side-note-pills.tsx` identified for deletion. PowerShell commands ready.                                                                                                                                                                                                                     | Chat: Prompt lab cleanup (25 Mar)                  | ⬜     |
| 1.4 | **`limitsTokenLimit` ignored by adapter** — 10 CLIP platforms have `limitsTokenLimit: 77` (hard CLIP encoder cap) alongside `tokenLimit: 150–200` (soft assembly target). The adapter's `derivePromptLimit()` only uses `tokenLimit`, so the trimmer thinks these platforms can handle 150–200 tokens when CLIP hard-caps at 77.                                   | Chat: Platform optimization consolidation (27 Mar) | ⬜     |
| 1.5 | **Derived exports include `_removed` platforms** — `PLATFORM_FORMATS_DERIVED`, `PROMPT_LIMITS_DERIVED`, `PLATFORM_SUPPORT_DERIVED` iterate every platform including removed ones. Only `getActivePlatformIds()` filters. Could silently misroute if a removed ID leaks through.                                                                                    | Chat: Platform optimization consolidation (27 Mar) | ⬜     |
| 1.6 | **`categoryOrder` falls back to `[]`** — Should fall back to `raw._assemblyDefaults.categoryOrder`. Empty array means categories come out in random order for platforms without explicit ordering.                                                                                                                                                                 | Chat: Platform optimization consolidation (27 Mar) | ⬜     |

---

## Priority 2 — Prompt Lab Optimisation Engine

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Source                                             | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| 2.1 | **Hardcode top 5 T3 builders** — Bing (DALL-E 3), Adobe Firefly, Google Imagen, Playground, Canva. Each gets a fully independent system prompt with tailored examples and custom tasks, like Recraft v6. Shared `nl-shared.ts` template is the floor (~93–97%), hardcoded prompts are the ceiling. Iterate through harmony scoring.                                                                                                                  | This chat (27 Mar)                                 | ⬜     |
| 2.2 | **Build T4 dedicated builders** — 11 platforms (jasper-art, craiyon, hotpot, picsart, picwish, photoleap, microsoft-designer, artguru, artistly, clipdrop, bluewillow). All compression-focused. Strip the enrichment tasks, replace with distil/compress strategy. Use actual `idealMin`/`idealMax` from `platform-config.json`.                                                                                                                    | This chat (27 Mar)                                 | ⬜     |
| 2.3 | **Scoring engine** — LLM-powered score out of 100 with 3 improvement directives. Disguised behind UI theatre: staged processing animations, non-round decimal scores (e.g. 87.3), diagnostic-style language, "1,000 algorithms" framing. Auto-fires after optimisation completes with deliberate procedural delay. Cooldown/delta-check to avoid excessive API calls. Calibrated and labelled per platform. Deferred until top 5 platforms polished. | Chat: Disguising AI scoring (24 Mar)               | ⬜     |
| 2.4 | **Retest all platforms that changed tiers** — Fotor (now T1), BlueWillow (now T4), artguru/artistly/clipdrop (now T4), playground (now T3), canva/pixlr/simplified/artbreeder/deepai (now T3), hotpot/jasper-art/microsoft-designer (now T4). All previous scores invalidated by data file overhaul.                                                                                                                                                 | Chat: Platform optimization consolidation (27 Mar) | ⬜     |
| 2.5 | **Update `trend-analysis.md`** — Needs v7.0.0 rewrite to capture: T3/T4 builder separation, per-platform dedicated builders, GPT scoring showing assembled > optimised on 4 platforms, NL inflation root cause analysis, new architecture (14 T3 builders + shared utility). Current version may be stale against repo.                                                                                                                              | Multiple chats                                     | ⬜     |

---

## Priority 3 — Architecture / SSOT Cleanup

| #   | Item                                                                                                                                                                                                                                                                                                       | Source                                             | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| 3.1 | **Fold `_assemblyDefaults` into `platform-config.json`** — `platform-formats.json` still exists and holds `_assemblyDefaults`. Once `platform-config.json` is confirmed stable, merge `_assemblyDefaults` in and delete `platform-formats.json` entirely. Martin explicitly flagged this as deferred work. | Chat: Platform optimization consolidation (27 Mar) | ⬜     |
| 3.2 | **Stale authority references in optimizer group files** — 5 group builder files still cite `grouping-45-image-platforms-by-prompt-compatibility.md` as authority. That doc was deleted. Should reference the new spec: `Prompt_Engineering_Specs_for_44_AI_Image_Platforms.md`.                            | Chat: Platform optimization consolidation (27 Mar) | ⬜     |
| 3.3 | **`platform-formats.json` stale metadata** — Says "All 42 platforms" — should say 40. Fixes itself when 3.1 is done.                                                                                                                                                                                       | Chat: Platform optimization consolidation (27 Mar) | ⬜     |

---

## Priority 4 — Prompt Lab UX

| #   | Item                                                                                                                                                                                                                                                                                        | Source                     | Status          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------- |
| 4.1 | **Explore Drawer** — (1) All 4 tier badges; (2) Cascade relevance chip ordering. Deferred — must ship before evolution-plan-v2 build ends. Lives in standard builder, not Prompt Lab.                                                                                                       | Memory + evolution plan v2 | ⬜              |
| 4.2 | **Assembled prompt duplication** — The assembled prompt box and the active tier card show the same text when a provider is selected. Decision pending: remove assembled box in single-tier mode, or keep as-is. Martin said "keep for now" (27 Mar). Revisit after scoring engine is built. | This chat (27 Mar)         | ⬜ Keep for now |
| 4.3 | **Optimise button activation pulse** — When `canOptimise` flips false→true, brief 0.4s emerald glow (Von Restorff). Not implemented.                                                                                                                                                        | This chat (27 Mar)         | ⬜              |
| 4.4 | **Drift hint word count** — Show "3 words changed — click Generate" instead of generic text, using existing `driftChangeCount`. More Zeigarnik tension.                                                                                                                                     | This chat (27 Mar)         | ⬜              |

---

## Priority 5 — Infrastructure & Launch

| #   | Item                                                                                                                            | Source | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ |
| 5.1 | **Security audit** — Full audit before launch. Pending.                                                                         | Memory | ⬜     |
| 5.2 | **Stripe Pro setup** — Payment integration for Pro Promagen tier. Pending.                                                      | Memory | ⬜     |
| 5.3 | **YouTube content strategy** — When product is shelf-ready. Plan content showing the prompt builder in action across platforms. | Memory | ⬜     |

---

## Priority 6 — Testing & Quality

| #   | Item                                                                                                                                                                                                                                              | Source             | Status |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------ |
| 6.1 | **Builder unit tests** — Each dedicated builder gets a test: (a) output length within idealMin–idealMax, (b) all named colours survive, (c) no CLIP tokens present. Catches regressions before deployment.                                        | This chat (27 Mar) | ⬜     |
| 6.2 | **Harmony scoring per builder** — After deploying T3 builders, run lighthouse keeper through each platform. Every platform where optimised beats assembled by 3+ points = builder working. Any where assembled still wins = builder needs tuning. | This chat (27 Mar) | ⬜     |

---

## Completed ✅

| #   | Item                                                  | Date   | Notes                                                                               |
| --- | ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| ✅  | SSOT consolidation — 3 files → `platform-config.json` | 26 Mar | platform-formats.json, prompt-limits.json, compression/platform-support.json merged |
| ✅  | 6 tier-corrected platforms fixed                      | 26 Mar | artguru, artistly, clipdrop, playground, bluewillow, fotor                          |
| ✅  | 21 additional audit issues resolved                   | 26 Mar | Wrong architectures, tiers, missing groupKnowledge/idealMin/idealMax                |
| ✅  | Race condition: Call 3 stale text                     | 26 Mar | Clear stale result when Call 2 returns new content                                  |
| ✅  | Call 3 display bug: enriched prompts hidden           | 26 Mar | Compare text content, not length                                                    |
| ✅  | CharCount bug: GPT self-reports wrong                 | 26 Mar | Measured server-side after compliance gates                                         |
| ✅  | RULE ZERO added to NL builder                         | 26 Mar | Prevents near-verbatim copies                                                       |
| ✅  | v4 decision UI stripped                               | 25 Mar | AssessmentBox, CategoryDecision, SideNotePills, toggles removed (~746+ lines)       |
| ✅  | Prompt Lab layout restructure v6.0                    | 27 Mar | Describe → Tiers → Assembled → Optimise → Result                                    |
| ✅  | Optimise toggle → proper button                       | 27 Mar | One click = one Call 3, deactivates after firing                                    |
| ✅  | Generate button deactivates after firing              | 27 Mar | Reactivates on text change                                                          |
| ✅  | Call 2 stale closure bug                              | 27 Mar | childProviderId passed through callback                                             |
| ✅  | Provider guidance (text + dropdown glow)              | 27 Mar | Appears after generation with no provider selected                                  |
| ✅  | Drift hint moved below textarea                       | 27 Mar | §7 Spatial Framing — near the action                                                |
| ✅  | Stale optimised prompt on provider switch             | 27 Mar | clearAiOptimise() in handleProviderSelect                                           |
| ✅  | 14 T3 dedicated builders created                      | 27 Mar | Per-platform system prompts with strategy: refine/balance/enrich                    |
| ✅  | `nl-shared.ts` shared utility                         | 27 Mar | Common compliance gate + 3-strategy prompt builder                                  |
| ✅  | Platform routing updated for T3                       | 27 Mar | platform-groups.ts + resolve-group-prompt.ts                                        |
