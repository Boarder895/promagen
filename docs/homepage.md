# ✅ Promagen Homepage Gold+ Feature Checklist

## 🥇 Core Architecture & Behaviour

- 🔁 **Dynamic `FinanceRibbon` Import** — SSR-safe and client-ready  
- 🧠 **Optimised `flag()` and `localTime()` Functions** — Clear, reusable helpers  
- 🧼 **Clean Grid Layout** — 3-column desktop, responsive tablet/mobile flow  
- 🔍 **No Redundant Preprocessing** — Local time is inline, no hard maps  
- 🧱 **Flexible Grid Tokens** — `GRID.east`, `GRID.centre`, `GRID.west` ready for branding reuse  
- 🔗 **External Links with Rel+Target** — Safe `noopener noreferrer` for all outbound links  
- 🧩 **Componentisation Ready** — Easily extract `<ExchangeTile>`, `<ProviderCard>`, etc.

## ♿ Accessibility & UX Standards

- 🦾 **ARIA-Compliant Markup** — `role="main"`, `region`, `complementary`, `listitem`, labelled clearly  
- 🔐 **Tab Navigation Support** — All cards are `tabIndex={0}` for keyboard access  
- 🪪 **Screen Reader Optimised Labels** — Regions are named, polite `aria-live` ready  
- 👀 **Reduced Motion Detection** — Suppresses animation if user prefers  
- 📜 **Semantic Landmarks** — Wraps content in meaningful `<section>`, `<article>`

## 📊 Content Logic & Visual Precision

- 🧪 **Test Hooks with `data-testid`** — Easy to target for CI and QA  
- 💬 **Empty State Messages** — Friendly fallbacks if data arrays are empty  
- 🧭 **Live Flag & Time by Country** — Unicode emoji + `tz`-based local clock  
- 🧱 **Leaderboard Ranking with Score** — Clear index, large digits, accessible readout  
- 🎨 **Unified Visual Style Tokens** — Reuse of `bg-white/5`, `ring-white/10`, `text-white/70`, `font-mono`  
- 🌍 **Correct East/West Exchange Rails** — Matches spec: east left, west reversed right

## 🏆 Future-Proofing & Elite Enhancements

- 📦 **Component Slotting Support** — Ready for `<Slot name="ribbon" />` for ribbon types  
- 🪄 **Skeleton Loaders (Optional)** — Use `animate-pulse` for shimmer previews  
- ⚠️ **Freshness Tags on FX Pairs** — Tags like `aging`, `delayed` based on timestamp  
- 🧰 **Error Boundaries on Major Blocks** — Leaderboard, ribbon, etc. safely wrapped  
- ⚙️ **Telemetry Anchors with `data-analytics-id`** — For tracking without JS bloat  
- 📜 **Consent-Aware Behaviour** — Ribbon shows only with UX or GDPR consent  
- 🪞 **RTL Layout Readiness** — Swap `ml`/`mr` with `ps`/`pe` for right-to-left support
