# Studio Page Authority Document

**Last updated:** 26 January 2026  
**Version:** 1.0.0  
**Owner:** Promagen  
**Authority:** This document defines the Studio hub page architecture, navigation, and component behaviour.

---

## Purpose

The Studio page (`/studio`) is the central hub for Promagen's creative tools. It provides:

- Visual overview of available features via 4 navigation cards
- Live exchange data integration (matching homepage)
- Finance ribbons (FX, Commodities, Crypto)
- Weather-driven context display
- Quick access to Library, Explore, Learn, and Playground

---

## Version History

| Version | Date        | Changes                                                              |
| ------- | ----------- | -------------------------------------------------------------------- |
| 1.0.0   | 26 Jan 2026 | Initial implementation with HomepageGrid layout and 4 feature cards  |

---

## File Locations

| File                                           | Purpose                  | Lines of Interest |
| ---------------------------------------------- | ------------------------ | ----------------- |
| `src/app/studio/page.tsx`                      | Server component (data)  | Full file         |
| `src/app/studio/studio-page-client.tsx`        | Client component (UI)    | Full file         |
| `src/components/layout/homepage-grid.tsx`      | Layout wrapper           | Full file         |
| `src/components/home/mission-control.tsx`      | Right panel (Home button)| Full file         |
| `docs/authority/studio-page.md`                | This document            | —                 |

---

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  [Finance Ribbon - FX/Commodities/Crypto]                                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌─────────────┐  ┌─────────────────────────────────────────────┐  ┌─────────────┐ │
│  │             │  │                                             │  │             │ │
│  │  Engine     │  │  ┌───────────────┐  ┌───────────────┐      │  │  Mission    │ │
│  │  Bay        │  │  │ 📚 Library    │  │ 🔍 Explore    │      │  │  Control    │ │
│  │             │  │  │ Saved prompts │  │ Style families│      │  │             │ │
│  │             │  │  │ Explore →     │  │ Explore →     │      │  │  [Home]     │ │
│  │             │  │  └───────────────┘  └───────────────┘      │  │  [Pro]      │ │
│  │             │  │  ┌───────────────┐  ┌───────────────┐      │  │  [Sign in]  │ │
│  │             │  │  │ 🎓 Learn      │  │ 🎮 Playground │      │  │             │ │
│  │             │  │  │ Prompt eng.   │  │ Experiment    │      │  │             │ │
│  │             │  │  │ Explore →     │  │ Explore →     │      │  │             │ │
│  │             │  │  └───────────────┘  └───────────────┘      │  │             │ │
│  │             │  │                                             │  │             │ │
│  └─────────────┘  └─────────────────────────────────────────────┘  └─────────────┘ │
│                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  [Exchange Rail - Left]              [AI Leaderboard]         [Exchange Rail - Right]│
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Server Component: `page.tsx`

Fetches data in parallel for optimal performance:

```typescript
export default async function StudioPage() {
  const [providers, exchanges, weatherIndex] = await Promise.all([
    getProviders(),
    getHomepageExchanges(),
    getWeatherIndex(),
  ]);

  return (
    <StudioPageClient
      providers={providers}
      exchanges={exchanges}
      weatherIndex={weatherIndex}
    />
  );
}
```

**File:** `src/app/studio/page.tsx`

**Data sources:**
- `getProviders()` — AI provider leaderboard data
- `getHomepageExchanges()` — Stock exchange data (48 exchanges)
- `getWeatherIndex()` — Weather data indexed by exchange ID

### Client Component: `studio-page-client.tsx`

Renders the full page using `HomepageGrid` with Studio-specific content:

```typescript
export default function StudioPageClient({
  providers,
  exchanges,
  weatherIndex,
}: StudioPageClientProps) {
  return (
    <HomepageGrid
      providers={providers}
      exchanges={exchanges}
      weatherIndex={weatherIndex}
      centreContent={<StudioFeatureGrid />}
      isStudioPage={true}  // ← Swaps Mission Control button
    />
  );
}
```

**File:** `src/app/studio/studio-page-client.tsx`

---

## Feature Cards

### Card Definitions

| Card       | Icon               | Title       | Description                    | Route               |
| ---------- | ------------------ | ----------- | ------------------------------ | ------------------- |
| Library    | 📚 (BookOpen)      | Library     | Your saved prompts             | `/studio/library`   |
| Explore    | 🔍 (Search)        | Explore     | Browse style families          | `/studio/explore`   |
| Learn      | 🎓 (GraduationCap) | Learn       | Master prompt engineering      | `/studio/learn`     |
| Playground | 🎮 (Gamepad2)      | Playground  | Experiment freely              | `/studio/playground`|

### Card Data Structure

```typescript
const studioSections = [
  {
    title: 'Library',
    description: 'Your saved prompts and favourites',
    href: '/studio/library',
    icon: <BookOpen className="h-6 w-6" />,
    gradient: 'from-purple-500 to-pink-500',
    glow: 'rgba(168, 85, 247, 0.2)',
    available: true,
  },
  {
    title: 'Explore',
    description: 'Browse style families and discover new aesthetics',
    href: '/studio/explore',
    icon: <Search className="h-6 w-6" />,
    gradient: 'from-sky-500 to-cyan-500',
    glow: 'rgba(14, 165, 233, 0.2)',
    available: true,
  },
  {
    title: 'Learn',
    description: 'Master the art of prompt engineering',
    href: '/studio/learn',
    icon: <GraduationCap className="h-6 w-6" />,
    gradient: 'from-emerald-500 to-teal-500',
    glow: 'rgba(16, 185, 129, 0.2)',
    available: true,
  },
  {
    title: 'Playground',
    description: 'Experiment freely with prompts',
    href: '/studio/playground',
    icon: <Gamepad2 className="h-6 w-6" />,
    gradient: 'from-amber-500 to-orange-500',
    glow: 'rgba(245, 158, 11, 0.2)',
    available: true,
  },
];
```

**File:** `src/app/studio/studio-page-client.tsx`  
**Lines:** 50-90 (approx)

### Navigation Implementation

**CRITICAL:** Cards use native `<a>` tags, NOT Next.js `<Link>` components.

**Reason:** Next.js `<Link>` components were failing to navigate due to z-index stacking contexts with glow effects. Native `<a>` tags provide guaranteed navigation.

```tsx
{studioSections.map((section) => {
  const CardContent = (
    <div className="group relative overflow-hidden rounded-2xl p-5 ...">
      {/* Glow effect - pointer-events-none to not block clicks */}
      <div className="absolute inset-0 ... pointer-events-none" />
      
      {/* Content wrapper - z-10 ensures content is above glow */}
      <div className="relative z-10">
        {/* Icon, Title, Description, Arrow */}
      </div>
    </div>
  );

  return section.available ? (
    <a key={section.href} href={section.href}>
      {CardContent}
    </a>
  ) : (
    <div key={section.href} className="opacity-60 cursor-not-allowed">
      {CardContent}
    </div>
  );
})}
```

**File:** `src/app/studio/studio-page-client.tsx`  
**Lines:** 380-450 (approx)

---

## Styling

### Card Container

```tsx
className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-500 cursor-pointer hover:ring-1 hover:ring-white/20"
style={{
  background: 'rgba(15, 23, 42, 0.7)',
  border: '1px solid rgba(255,255,255,0.1)',
}}
```

### Glow Effect

```tsx
<div 
  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
  style={{
    background: `radial-gradient(circle at 50% 50%, ${section.glow}, transparent 70%)`,
  }}
/>
```

**CRITICAL:** The glow effect MUST have `pointer-events-none` to allow clicks to pass through to the anchor element.

### Content Wrapper

```tsx
<div className="relative z-10">
  {/* All card content here */}
</div>
```

**CRITICAL:** The content wrapper MUST have `z-10` to ensure content is rendered above the glow effect and is clickable.

### Grid Layout

```tsx
<div className="grid gap-4 sm:grid-cols-2">
  {/* 4 cards */}
</div>
```

- Single column on mobile
- 2 columns on sm+ (≥640px)

---

## Mission Control Integration

When the Studio page loads, Mission Control displays a "Home" button instead of "Studio":

| Page              | Mission Control Button | Destination |
| ----------------- | ---------------------- | ----------- |
| Homepage (`/`)    | Studio                 | `/studio`   |
| Studio (`/studio`)| Home                   | `/`         |

**Prop:** `isStudioPage={true}` passed to `HomepageGrid`

**File:** `src/components/layout/homepage-grid.tsx`

---

## Route Structure

```
src/app/studio/
├── page.tsx                 # /studio → Studio hub
├── studio-page-client.tsx   # Client component
├── library/
│   └── page.tsx             # /studio/library → Saved prompts
├── explore/
│   └── page.tsx             # /studio/explore → Style families
├── learn/
│   └── page.tsx             # /studio/learn → Guides
└── playground/
    └── page.tsx             # /studio/playground → Prompt builder
```

---

## Testing Checklist

### Navigation

- [ ] Library card navigates to `/studio/library`
- [ ] Explore card navigates to `/studio/explore`
- [ ] Learn card navigates to `/studio/learn`
- [ ] Playground card navigates to `/studio/playground`
- [ ] Mission Control "Home" button navigates to `/`

### Visual

- [ ] 4 cards displayed in 2×2 grid on desktop
- [ ] Cards stack to single column on mobile
- [ ] Glow effect appears on hover
- [ ] Cards have correct gradient icons
- [ ] Exchange rails visible on sides
- [ ] Finance ribbon visible at top

### Data

- [ ] Exchange data loads correctly
- [ ] Weather data displays in Mission Control
- [ ] AI providers leaderboard visible

### Accessibility

- [ ] All cards keyboard focusable
- [ ] Focus ring visible on cards
- [ ] Cards have appropriate test IDs

---

## Test IDs

Each card has a test ID for automated testing:

```tsx
data-testid={`studio-card-${section.href.split('/').pop()}`}
```

Results in:
- `studio-card-library`
- `studio-card-explore`
- `studio-card-learn`
- `studio-card-playground`

---

## Debugging Navigation Issues

If cards stop navigating:

1. **Check DevTools Console** — Look for JavaScript errors
2. **Check Network tab** — Click card, see if request fires
3. **Inspect element** — Verify `<a href="/studio/library">` exists
4. **Check z-index** — Content must have `z-10`, glow must have `pointer-events-none`
5. **Check for overlays** — No elements should be blocking clicks

**Key principle:** Native `<a>` tags cannot fail unless something is intercepting them or the element isn't rendering.

---

## Related Documents

| Topic              | Document                         |
| ------------------ | -------------------------------- |
| Homepage layout    | `ribbon-homepage.md`             |
| Mission Control    | `mission-control.md`             |
| Engine Bay         | `ignition.md`                    |
| Prompt Intelligence| `prompt-intelligence.md` §9      |
| Learn page         | `learn-page-spec.md`             |
| Button styling     | `buttons.md`                     |

---

## Changelog

- **26 Jan 2026 (v1.0.0):** Initial implementation
  - Studio hub page using HomepageGrid layout
  - 4 feature cards: Library, Explore, Learn, Playground
  - Native `<a>` tags for navigation (fix for Link component failures)
  - Integration with Mission Control (`isStudioPage` prop)
  - Live exchange/weather data integration
  - Responsive 2-column grid layout

---

_This document is the authority for the Studio page. For individual feature pages, see their respective documents._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._
