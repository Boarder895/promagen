# Test Suite Notes

- **Artefacts:** saved under `tests/.artifacts/` and `tests/.lighthouse/` in CI.
- **Visual:** `home.vrt.spec.ts` masks timestamps/ribbon to avoid flicker.
- **A11y:** Axe enforces 0 critical/serious violations on home.
- **Lighthouse:** budgets enforced via `run-lh.mjs` with strict thresholds.
