# Test Utilities & Structure

Promagen uses a three-tier test layout. See the Code Standard “Tests Policy”.

## Where tests live
- **Component-scoped:** `src/**/__tests__/*.test.tsx`
- **Feature/domain-scoped:** `src/**/tests/*.test.ts`
- **App-scoped:** `src/__tests__/*.test.ts`

Jest discovers `**/*.test.{ts,tsx}` in both `__tests__` and `tests`.

## Utilities in this folder
Reusable helpers for all tests:
- `renderWithProviders(...)` – React Testing Library render with app providers.
- `userKeyboard` – ergonomic keyboard interactions.
- `mockTime` – freeze/advance timers safely.
- `a11yRoles` – ARIA role helpers for assertions.

> Contribute helpers here; avoid copying boilerplate into individual tests.
