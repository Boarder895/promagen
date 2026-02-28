// src/lib/learning/__tests__/learning-test-setup.ts
// ────────────────────────────────────────────────────────────────────────────
// Shared setup for the `learning` Jest project.
//
// Referenced from jest.config.cjs → learning project → setupFiles.
// Runs at module scope BEFORE any test code — no Jest globals needed.
//
// Purpose:
//   Silences diagnostic console.debug and console.error noise that bleeds
//   from the aggregate route handler (src/app/api/learning/aggregate/route.ts)
//   during aggregate-phase6.test.ts runs. The route handler emits ~150 lines
//   of [Learning Cron] debug logs per test run — all cosmetic, zero failures.
//
// Why module-scope (not beforeAll)?
//   setupFiles runs before the Jest framework is installed, so beforeAll
//   is not available. Module-scope override takes effect immediately and
//   stays active for the entire test file. This is safe because no learning
//   test relies on seeing console.debug or console.error output.
//
// Existing features preserved: Yes — zero test logic changes.
// ────────────────────────────────────────────────────────────────────────────

console.debug = () => {};

console.error = () => {};
