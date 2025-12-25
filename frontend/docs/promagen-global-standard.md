# Promagen Global Standard (Public Copy)

This document mirrors the operational rules enforced by CI and tests.

## Budgets & Categories
- Lighthouse: A11y = 100, SEO ≥ 95, Best Practices ≥ 95, Performance ≥ 90.
- Resource budgets: JS ≤ 180 KB gz, above-fold images ≤ 300 KB.
- Timing budgets: LCP ≤ 2.5 s, TBT ≤ 200 ms, CLS ≤ 0.10.

## Accessibility
- Axe: 0 critical/serious violations on home route.
- ARIA roles: main, complementary, list, listitem; labels mirror visible text.
- Prefers-reduced-motion respected; shimmer/timers pause.

## Data Integrity
- JSON catalogues (providers/exchanges/currencies/pairs) must validate.
- No inverse FX pairs; selected exchanges must exist in catalogue.

## Security & Privacy
- No client secrets; cookies scoped HttpOnly, Secure, SameSite ≥ Lax.
- Strict CSP applied at platform level; links to health endpoint present.

## Observability & Provenance
- Footer shows build fingerprint: `<sha> · <run> · <UTC date>`.
- Artefacts retained: Lighthouse JSON, visual diffs, schema report, SBOM.

## Visual Stability
- Playwright snapshots with masked dynamic regions.
- Pixel-diff threshold ≤ 0.15%.

## Release Gates
Any failure in the above blocks merge/deploy.
