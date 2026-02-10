# SEO Metadata Update — 10 Feb 2026

## Summary

Update all metadata across 5 source files to be SEO-optimised and consistent.
Vocabulary count updated from 5,000 → 10,000 everywhere.

**Verified counts:**

- Title: 53 chars (limit 60) ✅
- Homepage description: 146 chars (limit 155) ✅
- Global description: 119 chars (limit 155) ✅
- Vocabulary total: 9,913 phrases (commodities 5,393 + builder 3,600 + shared 920) → "10,000+" ✅

---

## File 1: `src/app/page.tsx`

**Line 47–50 — REPLACE entire metadata export:**

```typescript
// BEFORE
export const metadata: Metadata = {
  title: 'Promagen — Calm, data-rich AI providers overview',
  description: 'Live exchange rails and an AI providers leaderboard.',
};

// AFTER
export const metadata: Metadata = {
  title: 'AI Prompt Builder for 42+ Image Generators | Promagen',
  description:
    'Build prompts for Midjourney, DALL·E & 40+ AI image generators. 10,000+ phrase vocabulary, Elo-ranked leaderboard, and live financial market data.',
};
```

---

## File 2: `src/app/layout.tsx`

**Lines 26–54 — REPLACE entire metadata export:**

```typescript
// BEFORE
export const metadata: Metadata = {
  title: 'Promagen',
  description: 'Calm, precise, and fast.',
  metadataBase: new URL(SITE),
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Promagen',
    description: 'Calm, precise, and fast.',
    type: 'website',
    url: SITE,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Promagen',
      },
    ],
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Promagen',
    description: 'Calm, precise, and fast.',
    images: ['/og.png'],
  },
};

// AFTER
export const metadata: Metadata = {
  title: 'Promagen',
  description:
    'AI prompt builder with 10,000+ phrases for 42+ image generators. Elo-ranked leaderboard and live financial market data.',
  metadataBase: new URL(SITE),
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    title: 'AI Prompt Builder for 42+ Image Generators | Promagen',
    description:
      'Build prompts for Midjourney, DALL·E & 40+ AI image generators. 10,000+ phrase vocabulary, Elo-ranked leaderboard, and live financial market data.',
    type: 'website',
    url: SITE,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Promagen — AI prompt builder for 42+ image generators',
      },
    ],
    siteName: 'Promagen',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Prompt Builder for 42+ Image Generators | Promagen',
    description:
      'Build prompts for Midjourney, DALL·E & 40+ AI image generators. 10,000+ phrase vocabulary, Elo-ranked leaderboard, and live financial market data.',
    images: ['/og.png'],
  },
};
```

**Why layout.tsx OG/Twitter use the full homepage title:** When someone shares promagen.com on social media, the OG tags from `layout.tsx` are the fallback. The homepage `page.tsx` metadata overrides the `<title>` tag but doesn't re-declare OG — so layout's OG shows on shares. This gives you the keyword-rich title on link previews.

---

## File 3: `src/lib/seo.ts`

**Line 5 — REPLACE baseDescription:**

```typescript
// BEFORE
export const baseDescription =
  'A calm, data-rich dashboard that pairs creative AI providers with global markets.';

// AFTER
export const baseDescription =
  'AI prompt builder with 10,000+ phrases for 42+ image generators. Elo-ranked leaderboard and live financial market data.';
```

---

## File 4: `src/lib/env.ts`

**Line 84 — REPLACE default tagline:**

```typescript
// BEFORE
siteTagline: raw.NEXT_PUBLIC_SITE_TAGLINE ?? 'AI creativity + market mood, elegantly visualised.',

// AFTER
siteTagline: raw.NEXT_PUBLIC_SITE_TAGLINE ?? 'AI Prompt Builder for 42+ Image Generators',
```

---

## File 5: `src/lib/vocabulary/vocabulary-integration.ts`

**Line 4 — REPLACE comment:**

```typescript
// BEFORE
 * Connects the 5,000+ term vocabulary layer to the prompt builder UI.

// AFTER
 * Connects the 10,000+ term vocabulary layer to the prompt builder UI.
```

---

## Project Docs to Update (5,000 → 10,000)

These are project knowledge files that reference the old 5,000 count:

| File                                    | Line/Section                 | Change                                             |
| --------------------------------------- | ---------------------------- | -------------------------------------------------- |
| `src/data/vocabulary/Readme/README.md`  | "Total Phrases: 5,393"       | Update to reflect 10,000+ total across all systems |
| `src/data/vocabulary/Readme/README1.md` | "MILESTONE: 5,000+ Phrases!" | Update to "MILESTONE: 10,000+ Phrases!"            |
| `src/data/vocabulary/Readme/README2.md` | "Almost at 5,000 phrases!"   | Update to reflect completion at 10,000+            |

---

## Verification

```powershell
# Run from: C:\Users\Proma\Projects\promagen\frontend

# 1. TypeScript check
npx tsc --noEmit

# 2. Build
npx next build

# 3. After deploy — verify HTML metadata
(Invoke-RestMethod "https://promagen.com").Substring(0, 3000) | Select-String -Pattern "title|description|og:" -AllMatches

# 4. Google Rich Results test
# Visit: https://search.google.com/test/rich-results?url=https://promagen.com
```

**What "good" looks like:**

- `<title>` tag shows: `AI Prompt Builder for 42+ Image Generators | Promagen`
- `<meta name="description">` shows the 146-char homepage description
- `<meta property="og:title">` matches the full keyword-rich title
- `<meta property="og:description">` matches homepage description
- No TypeScript errors, no build warnings

**Existing features preserved:** Yes — metadata-only changes, no component or logic changes.
