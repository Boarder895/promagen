// src/app/api/tests/api-test-setup.ts
// ────────────────────────────────────────────────────────────────────────────
// Shared setup for the `api` Jest project.
//
// Referenced from jest.config.cjs → api project → setupFiles.
// Runs at module scope BEFORE any test code — no Jest globals needed.
//
// Purpose:
//   Silences diagnostic console.debug and console.error noise that bleeds
//   from route handlers and cross-module side effects during test runs.
//
// Why module-scope (not beforeAll)?
//   setupFiles runs before the Jest framework is installed, so beforeAll
//   is not available. Module-scope override takes effect immediately and
//   stays active for the entire test file. This is safe because no API
//   test relies on seeing console.debug or console.error output.
//
// Existing features preserved: Yes — zero test logic changes.
// ────────────────────────────────────────────────────────────────────────────

 
console.debug = () => {};
 
console.error = () => {};
