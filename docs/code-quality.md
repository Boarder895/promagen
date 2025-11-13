# ✅ Promagen Universal Code Quality Checklist (Gold+ Standard)

Apply this to **every frontend file** in the Promagen system: page components, shared components, ribbons, cards, utils, and layouts.

---

## 🏗️ Structure & Architecture

- 🔁 **Dynamic Import Where Needed** — Use `dynamic()` for client-only or interactive components  
- 📦 **Slot-Friendly Composition** — Build with `<Slot />` or children support if swappable content is expected  
- 🧱 **Flexible Grid & Layout Tokens** — Abstract widths/spans into variables (e.g. `GRID.centre`, `WRAP.max`)  
- 🧩 **Componentisation Ready** — Layouts and elements should be extractable to reusable components

---

## ♿ Accessibility & Motion

- 🦾 **ARIA Roles** — Use `role="region"`, `complementary`, `main`, `listitem`, etc. with clear `aria-label`  
- 👀 **Reduced Motion Respect** — Detect `prefers-reduced-motion` and suppress animation accordingly  
- 🔐 **Keyboard Navigation** — Ensure `tabIndex={0}` for custom cards, tiles, or media  
- 🪪 **Screen Reader Enhancements** — Add `aria-live`, `aria-describedby` or `aria-hidden` where appropriate  
- 📜 **Semantic HTML** — Use `<section>`, `<article>`, `<header>`, not just `<div>`

---

## 📊 Visual & Behavioural Contracts

- 🎨 **Unified Tokens** — Apply shared Tailwind styles (`bg-white/5`, `ring-white/10`, `font-mono`, `text-white/70`)  
- 💬 **Empty State Messaging** — Every map-rendered block should handle `length === 0` with friendly fallback  
- ⚠️ **Staleness or Freshness Tags** — If time-sensitive, tag with `aging`, `delayed`, or "updated x mins ago"  
- 🔁 **Toggle/State Awareness** — Use stateful props with `aria-pressed`, `aria-expanded`, etc.  
- 🪄 **Skeleton States (Optional)** — Use `animate-pulse` when async content is loading  
- 🧰 **Error Boundaries (Where Needed)** — Wrap ribbon, leaderboard, or heavy fetch sections

---

## 🔎 Testability & Telemetry

- 🧪 **Add `data-testid`** — Tag outer wrapper or anchor for unit/integration targeting  
- ⚙️ **`data-analytics-id` Hooks** — Passive anchors for telemetry/analytics collection  
- 🔗 **External Link Safety** — All outbound links must use `rel="noopener noreferrer"` and `target="_blank"`

---

## 📦 Maintainability & Reusability

- 🧠 **Extract Logic to Helpers** — e.g. `flag()`, `localTime()` → utils folder  
- 🧹 **Avoid Duplicate Filters/Maps** — Use `useMemo()` or chained `.map(...).filter(...)`  
- 🧼 **Consistent Function Signatures** — e.g. `(props: ComponentProps)` → not destructured unless internal  
- 🪞 **RTL-Ready Layout** — Use Tailwind logical spacing classes (`ps-`, `pe-`, `start-`, `end-`)

---

## 🚦 Optional Advanced Patterns

- 📜 **Consent-Aware Rendering** — Load ribbons and data based on `useConsent()` result  
- 🧭 **Slot Layout Contracts** — For tabs, modal containers, layout wrappers — support render prop or named slot  
- 🧱 **Theme Token Compatibility** — Future dark/light variants or client theming (`theme.color.primary/50`)  
- 🪄 **Client–Server Hybrid Awareness** — Use `useEffect`/`useLayoutEffect` appropriately  
- 🌍 **Global Context Safety** — Avoid global imports for state; use hooks/providers

---

## ✅ Output Format Expectations

Every file should:
- Export a clean default (or named) function  
- Be ready to drop into `frontend/src/...`  
- Follow Promagen naming conventions (kebab-case folder, camelCase files, PascalCase components)  
- Use only libraries defined in `package.json` unless scoped otherwise

# Test Utilities and Structure

Promagen test structure follows the **Tests Policy** from the Code Standard.

**Quick guide:**
- Component → `__tests__/`
- Domain logic → `tests/`
- Full app → `src/__tests__/`

### Utilities here
All reusable helpers live here, e.g.:
- `renderWithProviders` (RTL helper)
- `userKeyboard` (keyboard actions)
- `mockTime` (freeze time)
- `a11yRoles` (ARIA helpers)

src/
├── components/
│   └── ui/__tests__/tabs.keyboard.test.tsx
│   └── ui/__tests__/tabs.live.test.tsx
│   └── ribbon/tests/finance-ribbon.render.test.tsx
├── data/tests/
│   └── cosmic.shape.test.ts
│   └── catalogs.shape.test.ts
│   └── country-currency.integrity.test.ts
└── __tests__/
    └── fx.compute-daily-arrow.test.ts
    └── schemas.catalogs.test.ts
