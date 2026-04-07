# Prompt Intelligence

**Last updated:** 6 April 2026
**Version:** 3.0.0
**Owner:** Promagen
**Authority:** This document defines the architecture, data structures, and implementation for the **client-side** Prompt Intelligence system used in the standard prompt builder (`/providers/[id]`).

> **Scope clarification:** This system runs entirely in the browser — no server calls for scoring, suggestions, or conflict detection. It powers the standard prompt builder's dropdown intelligence, smart suggestions, conflict warnings, and coherent randomise.
>
> **This is NOT the Prompt Lab AI engine.** The Prompt Lab (`/studio/playground`) uses a separate server-side three-call pipeline (Call 1: category assessment, Call 2: 4-tier generation, Call 3: platform optimisation) documented in `ai-disguise.md` v5.0.0, `prompt-lab.md` v4.0.0, and `prompt-optimizer.md` v6.0.0. The client-side prompt intelligence described here is used by the standard builder only.

**Cross-references:**

- `ai-disguise.md` v5.0.0 — AI engine, Call 2 system prompt v4.5, post-processing, harmony engineering
- `prompt-lab.md` v4.0.0 — Prompt Lab routes, component table, data flow
- `prompt-lab-v4-flow.md` v2.0.0 — Check → Assess → Decide → Generate four-phase flow
- `prompt-optimizer.md` v6.0.0 — Call 3 architecture, 40 independent builders
- `prompt-builder-page.md` — Standard builder architecture
- `human-sentence-conversion.md` v2.0.0 — Human sentence conversion UI and term matching
- `paid_tier.md` v8.0.0 — §5.14 colour-coded prompt anatomy, §5.13 Prompt Lab parity
- `buttons.md` v4.0.0 — Button styling standards
- `builder-quality-intelligence.md` v3.0.0 — Internal regression testing for Call 3 builders

---

## 1. Purpose

Prompt Intelligence transforms Promagen's prompt builder from a simple selection tool into an **intelligent, educational system** that helps users craft better prompts while teaching them prompt literacy.

### Core Principles

1. **User intent is sacred** — User-typed text always takes priority, is never trimmed, and anchors the prompt
2. **Education through use** — Users learn what works by seeing coherence scores, conflict warnings, and contextual suggestions
3. **Market bridge** — Live market data influences suggestions, making Promagen unique
4. **Zero latency** — All intelligence runs client-side for instant feedback
5. **Existing layout unchanged** — The prompt builder UI stays exactly as-is; intelligence enhances behaviour, not appearance

### What This Enables

| Capability             | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| **Live reordering**    | Dropdown options reorder by relevance as user builds prompt   |
| **Smart trim**         | When over character limit, trims lowest-relevance terms first |
| **Conflict detection** | Warns when selected terms clash (e.g., vintage + cyberpunk)   |
| **Suggested chips**    | Context-aware "Suggested for you" options appear              |
| **Coherent randomise** | 🎲 button generates thematically coherent prompts             |
| **Subject anchor**     | User's subject always leads the prompt                        |
| **Market mood**        | Live market state tints suggestions                           |
| **Prompt DNA**         | Visual coherence indicator educates users                     |

---

## 2. Architecture Overview

### Client-Side Design

All intelligence runs in the browser. No server calls for scoring or suggestions. This applies to the **standard prompt builder** (`/providers/[id]`) only. The Prompt Lab (`/studio/playground`) uses server-side AI calls (Call 1/2/3) documented separately in `ai-disguise.md` v5.0.0.

**Rationale:**

- Data is small (~15-20KB gzipped)
- Speed is critical — users need instant feedback
- Zero server costs
- Works offline
- Fits existing architecture (`prompt-options.json` already client-side)

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  PROMPT INTELLIGENCE LAYER                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │ Semantic     │    │ Market       │    │ Community    │     │
│   │ Tags         │ +  │ Mood         │ +  │ Trends       │     │
│   │ (2,056 opts) │    │ (Live FX)    │    │ (Phase 4)    │     │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘     │
│          │                   │                   │              │
│          └───────────────────┼───────────────────┘              │
│                              ▼                                   │
│                    ┌──────────────────┐                         │
│                    │   SCORER         │                         │
│                    │   (Unified)      │                         │
│                    └────────┬─────────┘                         │
│                             │                                    │
│          ┌──────────────────┼──────────────────┐                │
│          ▼                  ▼                  ▼                │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │ Live        │    │ Smart       │    │ Conflict    │        │
│   │ Reorder     │    │ Trim        │    │ Detection   │        │
│   └─────────────┘    └─────────────┘    └─────────────┘        │
│          │                  │                  │                │
│          └──────────────────┼──────────────────┘                │
│                             ▼                                    │
│                    ┌──────────────────┐                         │
│                    │ PROMPT BUILDER   │                         │
│                    │ (UI unchanged)   │                         │
│                    └──────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Architecture

### 3.1 File Structure (New)

```
src/data/prompt-intelligence/
├── semantic-tags.json          # Every option tagged with families
├── families.json               # Family definitions + relationships
├── conflicts.json              # Known incompatible combinations
├── market-moods.json           # Market state → suggestion mappings
└── platform-hints.json         # Platform-specific behaviours
```

### 3.2 Lib Module (New)

```
src/lib/prompt-intelligence/
├── index.ts                    # Public API (single import point)
├── types.ts                    # TypeScript definitions
├── parser.ts                   # Extract context from user text
├── scorer.ts                   # Relevance scoring engine
├── reorder.ts                  # Live dropdown reordering
├── trim.ts                     # Smart trim (replaces dumb trim)
├── combine.ts                  # Merge similar terms
├── conflicts.ts                # Detect + warn conflicts
├── suggestions.ts              # "Suggested for you" chips
├── randomise.ts                # Coherent randomisation
├── market-mood.ts              # Market data → suggestions
└── dna.ts                      # Prompt DNA visualisation
```

---

## 4. Data Structures

### 4.1 semantic-tags.json

Every prompt option tagged with semantic metadata.

```json
{
  "version": "1.0.0",
  "options": {
    "cyberpunk": {
      "category": "style",
      "families": ["sci-fi", "urban", "neon"],
      "mood": "intense",
      "era": "future",
      "conflicts": ["vintage", "pastoral", "rustic"]
    },
    "vintage": {
      "category": "style",
      "families": ["retro", "nostalgic", "warm"],
      "mood": "calm",
      "era": "past",
      "conflicts": ["cyberpunk", "futuristic", "neon"]
    },
    "abandoned hospital": {
      "category": "subject",
      "families": ["decay", "medical", "urban-exploration"],
      "mood": "eerie",
      "suggests": {
        "atmosphere": ["eerie", "clinical", "desolate"],
        "lighting": ["harsh fluorescent", "dim", "dramatic shadows"],
        "colour": ["desaturated", "cold", "muted"]
      }
    },
    "golden hour": {
      "category": "lighting",
      "families": ["warm", "natural", "cinematic"],
      "mood": "calm",
      "timeOfDay": "evening",
      "complements": ["portrait", "landscape", "romantic"]
    }
  }
}
```

**Schema:**

```typescript
interface SemanticTag {
  category: PromptCategory;
  families: string[]; // 1-5 family tags
  mood?: "calm" | "intense" | "neutral" | "eerie" | "joyful";
  era?: "past" | "present" | "future" | "timeless";
  conflicts?: string[]; // Options that clash with this
  complements?: string[]; // Options that work well with this
  suggests?: Partial<Record<PromptCategory, string[]>>; // Cross-category suggestions
}
```

### 4.2 families.json

Defines style families and their relationships.

```json
{
  "version": "1.0.0",
  "families": {
    "sci-fi": {
      "displayName": "Science Fiction",
      "description": "Futuristic, technological, speculative",
      "members": [
        "cyberpunk",
        "futuristic",
        "neon",
        "holographic",
        "chrome",
        "dystopian"
      ],
      "related": ["urban", "neon", "tech"],
      "opposes": ["rustic", "vintage", "pastoral", "organic"],
      "mood": "intense",
      "suggestedColours": ["neon", "chrome", "electric blue", "magenta"],
      "suggestedLighting": ["neon glow", "harsh artificial", "rim lighting"]
    },
    "retro": {
      "displayName": "Retro / Vintage",
      "description": "Nostalgic, classic, historical aesthetics",
      "members": ["vintage", "art deco", "50s", "70s", "film grain", "sepia"],
      "related": ["nostalgic", "warm", "analog"],
      "opposes": ["cyberpunk", "minimalist", "futuristic", "digital"],
      "mood": "nostalgic",
      "suggestedColours": ["sepia", "warm", "muted", "faded"],
      "suggestedLighting": ["soft daylight", "tungsten", "golden hour"]
    },
    "dark-moody": {
      "displayName": "Dark & Moody",
      "description": "Dramatic, atmospheric, intense",
      "members": ["noir", "gothic", "dramatic", "cinematic", "moody"],
      "related": ["cinematic", "dramatic", "atmospheric"],
      "opposes": ["cheerful", "bright", "minimal", "cute"],
      "mood": "intense",
      "suggestedColours": ["desaturated", "cold", "high contrast"],
      "suggestedLighting": ["dramatic shadows", "low key", "rim lighting"]
    },
    "organic": {
      "displayName": "Organic / Natural",
      "description": "Nature-inspired, soft, living",
      "members": ["botanical", "floral", "earthy", "natural", "pastoral"],
      "related": ["soft", "natural", "warm"],
      "opposes": ["cyberpunk", "industrial", "chrome", "neon"],
      "mood": "calm",
      "suggestedColours": ["earth tones", "green", "warm brown"],
      "suggestedLighting": ["natural daylight", "dappled light", "soft"]
    }
  }
}
```

### 4.3 conflicts.json

Explicit conflict definitions for clear warnings.

```json
{
  "version": "1.0.0",
  "conflicts": [
    {
      "terms": ["vintage", "cyberpunk"],
      "reason": "Conflicting eras: vintage (past) vs cyberpunk (future)",
      "suggestion": "Choose one era. Try 'retro-futurism' if you want both."
    },
    {
      "terms": ["minimalist", "baroque"],
      "reason": "Conflicting complexity: minimalist (simple) vs baroque (ornate)",
      "suggestion": "These styles have opposite philosophies."
    },
    {
      "terms": ["cheerful", "noir"],
      "reason": "Conflicting moods: cheerful (bright) vs noir (dark)",
      "suggestion": "Pick a dominant mood for coherent results."
    },
    {
      "terms": ["soft lighting", "harsh shadows"],
      "reason": "Conflicting lighting approaches",
      "suggestion": "Choose one lighting mood."
    }
  ],
  "softConflicts": [
    {
      "terms": ["portrait", "wide angle"],
      "reason": "Wide angle can distort portraits",
      "suggestion": "Consider 85mm or 50mm for portraits."
    }
  ]
}
```

### 4.4 market-moods.json

Maps live market states to suggestion boosts.

```json
{
  "version": "1.0.0",
  "moods": {
    "market_opening": {
      "trigger": "Market Pulse: exchange opening within ±1 min",
      "boost": {
        "atmosphere": ["awakening", "fresh", "energetic", "optimistic"],
        "lighting": ["morning light", "dawn", "golden hour", "soft daylight"],
        "colour": ["warm", "vibrant", "fresh"],
        "style": ["dynamic", "energetic"]
      },
      "boostWeight": 1.3
    },
    "market_closing": {
      "trigger": "Market Pulse: exchange closing within ±1 min",
      "boost": {
        "atmosphere": ["reflective", "calm", "contemplative", "peaceful"],
        "lighting": ["golden hour", "dusk", "sunset", "warm"],
        "colour": ["warm", "muted", "golden"],
        "style": ["cinematic", "nostalgic"]
      },
      "boostWeight": 1.3
    },
    "high_volatility": {
      "trigger": "FX volatility > threshold (TBD)",
      "boost": {
        "atmosphere": [
          "chaotic",
          "dynamic",
          "turbulent",
          "intense",
          "electric"
        ],
        "lighting": ["dramatic", "harsh", "high contrast"],
        "colour": ["bold", "saturated", "contrasting"],
        "style": ["dramatic", "intense", "bold"]
      },
      "boostWeight": 1.4
    },
    "low_volatility": {
      "trigger": "FX volatility < threshold (TBD)",
      "boost": {
        "atmosphere": ["calm", "serene", "balanced", "peaceful", "stable"],
        "lighting": ["soft", "even", "diffused"],
        "colour": ["muted", "harmonious", "monochromatic"],
        "style": ["minimal", "clean", "balanced"]
      },
      "boostWeight": 1.2
    },
    "currency_strength_usd": {
      "trigger": "USD strengthening significantly",
      "boost": {
        "colour": ["green", "gold"],
        "style": ["corporate", "powerful", "bold"]
      },
      "boostWeight": 1.1
    },
    "gold_rising": {
      "trigger": "Gold price rising significantly",
      "boost": {
        "colour": ["golden", "warm", "luxurious"],
        "atmosphere": ["opulent", "rich", "prestigious"],
        "materials": ["gold", "metallic", "luxurious"]
      },
      "boostWeight": 1.2
    }
  }
}
```

## 4.5 Gallery Mode Integration (v2.1.0 — SUPERSEDED)

> **Status:** Gallery Mode as a standalone feature was never shipped. The concept evolved into the **Scene Starters** system (200 scenes across 23 worlds, deployed on the homepage as `SceneStartersPreview`) and the **Prompt Showcase** (Prompt of the Moment, weather-driven). The integration architecture described below was the design intent — some data flows (weather→atmosphere, market mood→prompt influence) are used by the weather prompt generator but not as a standalone gallery page. No `/gallery` route exists in the codebase.

The Prompt Intelligence system powers Gallery Mode's automatic prompt generation. Market moods, semantic tags, and the 4-tier platform system work together to create city-specific prompts.

### How Gallery Mode Uses Prompt Intelligence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     GALLERY MODE PROMPT PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ THEME ENGINE │    │ MARKET MOOD  │    │ PROMPT       │                  │
│  │              │───▶│ ENGINE       │───▶│ BUILDER      │                  │
│  │ • City data  │    │              │    │              │                  │
│  │ • Local time │    │ • FX data    │    │ • Scene Brief│                  │
│  │ • Season     │    │ • Crypto     │    │ • Caps check │                  │
│  │ • Weather    │    │ • Commodities│    │ • 4 variants │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                   │                          │
│         └───────────────────┼───────────────────┘                          │
│                             ▼                                              │
│                    ┌──────────────────┐                                    │
│                    │ semantic-tags.json│  ◀── Tags, families, conflicts    │
│                    │ market-moods.json │  ◀── Mood triggers & boosts       │
│                    │ platform-hints.json│ ◀── 4-tier syntax rules          │
│                    └──────────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CitySnapshot → Scene Brief Pipeline

Gallery Mode builds a `CitySnapshot` for each exchange, then converts it to a `SceneBrief`:

````typescript
// Step 1: Build CitySnapshot from exchange data
interface CitySnapshot {
  exchangeId: string;
  city: string;
  country: string;
  localTime: Date;
  timeOfDay: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night';
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  isMarketOpen: boolean;
  weather?: { conditions: string; temperatureC: number };
  mood: MarketMoodResult;
}

// Step 2: Convert to Scene Brief using Prompt Intelligence
interface SceneBrief {
  anchor: string; // City landmark (from semantic-tags)
  lighting: string; // Single descriptor
  style: string; // Single profile
  camera: string; // Single angle
  atmosphere: string[]; // Max 3 (mood + weather + time)
  hook?: string; // Cosmic event, cultural moment
  motifs: string[]; // Max 2 (seasonal, cultural)
  constraints: string; // "No text, no logos"
  negativePrompt: string; // Platform-appropriate
}

### Market Mood → Prompt Influence

When Gallery Mode detects a market mood, it uses the boosts from `market-moods.json`:

```typescript
function applyMoodToSceneBrief(brief: Partial<SceneBrief>, mood: MarketMoodResult): SceneBrief {
  // Mood boosts have higher priority than base values
  const moodAtmosphere = mood.boosts.atmosphere || [];
  const moodLighting = mood.boosts.lighting?.[0];
  const moodColour = mood.boosts.colour || [];

  // Combine with existing atmosphere (caps enforced)
  const atmosphere = dedupeAndCap(
    [
      ...moodAtmosphere, // Highest priority
      ...(brief.atmosphere || []), // Time-based
      ...weatherAtmosphere, // Weather-based
    ],
    3,
  ); // Max 3 atmosphere terms

  return {
    ...brief,
    atmosphere,
    lighting: moodLighting || brief.lighting,
    // Mood colours influence materials/style where applicable
  };
}
````

### Weather → Atmosphere Mapping

Gallery Mode converts weather conditions to atmosphere terms:

```typescript
// Maps weather conditions to semantic-tags atmosphere values
const WEATHER_ATMOSPHERE_MAP: Record<string, string[]> = {
  storm: ["dramatic", "intense", "electric"],
  thunder: ["dramatic", "intense", "electric"],
  rain: ["moody", "reflective", "glistening"],
  drizzle: ["moody", "reflective", "glistening"],
  snow: ["serene", "pristine", "cold"],
  fog: ["mysterious", "ethereal", "diffused"],
  mist: ["mysterious", "ethereal", "diffused"],
  cloud: ["overcast", "soft light"],
  clear: ["vibrant", "bright", "warm"],
  sunny: ["vibrant", "bright", "warm"],
};

function weatherToAtmosphere(conditions: string): string[] {
  const lower = conditions.toLowerCase();
  for (const [key, atmosphere] of Object.entries(WEATHER_ATMOSPHERE_MAP)) {
    if (lower.includes(key)) return atmosphere;
  }
  return ["vibrant", "bright", "warm"]; // Default: clear
}
```

### 4-Tier Prompt Rendering for Gallery

Scene Brief renders to 4 deterministic prompts using `platform-hints.json`:

```typescript
function renderSceneBrief(brief: SceneBrief): Record<PromptTier, string> {
  return {
    tier1: renderTier1(brief), // CLIP-Based: weights, parentheses
    tier2: renderTier2(brief), // Midjourney: --ar, --no
    tier3: renderTier3(brief), // Natural Language: sentences
    tier4: renderTier4(brief), // Plain Language: simple
  };
}

// Example output for Tokyo at twilight with gold_rising mood:
{
  tier1: "Tokyo skyline at twilight::1.3, golden hour light, opulent, warm, serene, cherry blossom motifs, (Mount Fuji:1.2), cinematic photography, wide angle --no text logos",

  tier2: "Tokyo skyline at twilight, golden hour light, opulent warm serene atmosphere, cherry blossom season, Mount Fuji background, cinematic photography, wide angle --ar 16:9 --no text logos watermarks",

  tier3: "A serene photograph of the Tokyo skyline at twilight during cherry blossom season. The scene is bathed in warm golden hour light with an opulent, prestigious atmosphere. Mount Fuji is visible in the background. Shot in a cinematic style with a wide angle lens. No text or logos.",

  tier4: "Tokyo skyline at sunset with cherry blossoms, warm golden light, Mount Fuji in background, elegant mood, wide angle photo"
}
```

### Caps Enforcement in Gallery Mode

Gallery Mode enforces stricter caps than manual prompt building:

| Category       | Manual Builder | Gallery Mode | Rationale               |
| -------------- | -------------- | ------------ | ----------------------- |
| Anchor         | 1              | 1            | Single city focal point |
| Lighting       | 1              | 1            | Consistent mood         |
| Style          | 1              | 1            | Coherent aesthetic      |
| Camera         | 1              | 1            | Single perspective      |
| **Atmosphere** | 2-3            | **3 max**    | Mood + weather + time   |
| Hook           | 1              | **0-1**      | Only if cosmic event    |
| Motifs         | 2              | **2 max**    | Seasonal + cultural     |

### Conflict Avoidance

Gallery Mode uses `conflicts.json` to prevent incoherent prompts:

```typescript
function validateSceneBrief(brief: SceneBrief): ValidationResult {
  const allTerms = [
    brief.lighting,
    brief.style,
    ...brief.atmosphere,
    ...brief.motifs,
  ].filter(Boolean);

  // Check against conflicts.json
  const conflicts = detectConflicts(allTerms);

  if (conflicts.length > 0) {
    // Remove lowest-priority conflicting term
    return removeLowestPriorityConflict(brief, conflicts);
  }

  return { valid: true, brief };
}
```

### Negative Prompts

Gallery Mode always includes platform-appropriate negatives:

```typescript
const GALLERY_NEGATIVE_PROMPTS = {
  universal: "text, logos, watermarks, words, letters, signatures",
  safety: "political symbols, gore, explicit content, nudity, real people",
  quality: "distorted faces, extra limbs, blurry, low quality, artifacts",
};

function getNegativePrompt(tier: PromptTier): string {
  const parts = [
    GALLERY_NEGATIVE_PROMPTS.universal,
    GALLERY_NEGATIVE_PROMPTS.safety,
  ];

  // Add quality negatives for CLIP-based platforms
  if (tier === "tier1" || tier === "tier2") {
    parts.push(GALLERY_NEGATIVE_PROMPTS.quality);
  }

  return parts.join(", ");
}
```

### City Anchors (Semantic Tags)

Gallery Mode uses pre-defined city anchors from semantic-tags:

```json
{
  "cityAnchors": {
    "Tokyo": ["Tokyo skyline", "Shibuya crossing", "Tokyo Tower silhouette"],
    "London": ["London skyline", "Tower Bridge", "Big Ben silhouette"],
    "New York": ["Manhattan skyline", "Brooklyn Bridge", "Central Park"],
    "Sydney": ["Sydney harbour", "Opera House silhouette", "Harbour Bridge"],
    "Hong Kong": ["Victoria Harbour", "Hong Kong skyline", "neon-lit streets"]
    // ... 79 cities total
  }
}
```

### Integration Files

| File                  | Gallery Mode Use                               |
| --------------------- | ---------------------------------------------- |
| `semantic-tags.json`  | City anchors, atmosphere terms, style profiles |
| `market-moods.json`   | Mood triggers and boost values                 |
| `platform-hints.json` | 4-tier syntax rules, character limits          |
| `conflicts.json`      | Prevent incoherent term combinations           |
| `families.json`       | Style family coherence validation              |

Authority for Gallery Mode implementation: `docs/authority/gallery-mode-master.md`

---

## 5. User Input Rules

### 5.1 Subject Anchor

When the user types custom text in the **Subject** field, it becomes the anchor of the entire prompt.

| Rule             | Behaviour                                                                              |
| ---------------- | -------------------------------------------------------------------------------------- |
| Position         | User subject appears FIRST in assembled prompt                                         |
| Protection       | NEVER trimmed, regardless of character limit                                           |
| Randomise        | 🎲 button does NOT overwrite user's typed subject                                      |
| Dropdown subject | If user selects from dropdown (not types), still first but CAN be swapped by Randomise |

**Output structure:**

```
[USER SUBJECT], [other categories in order...]
```

### 5.2 Custom Text in Other Categories

| Rule            | Behaviour                                                |
| --------------- | -------------------------------------------------------- |
| Position        | Appears before dropdown selections within that category  |
| Protection      | NEVER trimmed                                            |
| Always included | Custom text in any field always makes it to final prompt |

### 5.3 Dropdown Selections

| Rule            | Behaviour                                                                 |
| --------------- | ------------------------------------------------------------------------- |
| Can be trimmed  | Yes, when over platform character limit                                   |
| Trim order      | Lowest relevance score trimmed first                                      |
| Can be combined | Yes, similar terms merged (e.g., "neon" + "cyberpunk" → "neon cyberpunk") |
| Outlier removal | Terms that conflict with majority get trimmed first                       |

### 5.4 Example Output

**User input:**

- Subject (typed): `my grandmother's 1950s kitchen`
- Environment (typed): `dusty afternoon light through lace curtains`
- Style (dropdown): vintage
- Lighting (dropdown): warm tungsten
- Fidelity (dropdown): film grain

**Assembled prompt:**

```
my grandmother's 1950s kitchen, dusty afternoon light through lace curtains, vintage, warm tungsten, film grain
↑ SUBJECT ANCHOR (typed)       ↑ PROTECTED (typed)                              ↑ dropdown selections (can trim)
```

---

## 6. Scoring Algorithm

### 6.1 Relevance Score (0-100)

Each option scored against current prompt context.

```typescript
function calculateRelevance(option: string, context: PromptContext): number {
  let score = 50; // Base score

  const optionTags = getSemanticTags(option);

  // Family match: +20 per matching family
  for (const family of optionTags.families) {
    if (context.activeFamily === family) score += 20;
    if (context.relatedFamilies.includes(family)) score += 10;
  }

  // Mood match: +15
  if (optionTags.mood === context.dominantMood) score += 15;

  // Era match: +10
  if (optionTags.era === context.era) score += 10;

  // Conflict penalty: -30 per conflict
  for (const conflict of optionTags.conflicts || []) {
    if (context.selectedTerms.includes(conflict)) score -= 30;
  }

  // Complement bonus: +10
  for (const complement of optionTags.complements || []) {
    if (context.selectedTerms.includes(complement)) score += 10;
  }

  // Market mood boost (when enabled)
  if (context.marketMoodEnabled) {
    const boost = getMarketBoost(option, context.marketState);
    score *= boost; // e.g., 1.3 for boosted terms
  }

  return Math.max(0, Math.min(100, score));
}
```

### 6.2 Context Extraction

Parse user's typed text to extract semantic context.

```typescript
interface PromptContext {
  // From user's typed subject
  subjectKeywords: string[];

  // Derived from all selections
  activeFamily: string | null; // Most common family
  relatedFamilies: string[]; // All related families
  dominantMood: string | null; // Most common mood
  era: string | null; // Past/present/future
  selectedTerms: string[]; // All selected options

  // Market state (when Market Mood enabled)
  marketMoodEnabled: boolean;
  marketState: MarketState | null;
}
```

### 6.3 Coherence Score (Prompt DNA)

Overall prompt coherence as percentage.

```typescript
function calculateCoherence(selections: PromptSelections): CoherenceResult {
  const allTerms = flattenSelections(selections);
  const tags = allTerms.map(getSemanticTags);

  // Count family consistency
  const familyCounts = countFamilies(tags);
  const dominantFamilyRatio = max(familyCounts) / allTerms.length;

  // Count conflicts
  const conflicts = detectConflicts(allTerms);
  const conflictPenalty = conflicts.length * 10;

  // Count mood consistency
  const moodCounts = countMoods(tags);
  const moodConsistency = max(moodCounts) / allTerms.length;

  // Calculate final score
  const score = Math.round(
    dominantFamilyRatio * 50 + moodConsistency * 30 + (20 - conflictPenalty),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    conflicts,
    dominantFamily: getDominantFamily(familyCounts),
    dominantMood: getDominantMood(moodCounts),
    categoryFill: getCategoryFillStatus(selections),
  };
}
```

---

## 7. Smart Trim Algorithm

### 7.1 Trim Priority

When prompt exceeds platform character limit:

1. **Never trim:** User-typed text (any category)
2. **Never trim:** Subject selections (even dropdown)
3. **Trim first:** Lowest relevance score
4. **Trim first:** Terms that conflict with majority
5. **Combine before trim:** Similar terms merge

### 7.2 Combine Logic

Before trimming, attempt to combine similar terms.

```typescript
function attemptCombine(terms: string[]): string[] {
  const combined: string[] = [];
  const used = new Set<string>();

  for (let i = 0; i < terms.length; i++) {
    if (used.has(terms[i])) continue;

    const termTags = getSemanticTags(terms[i]);

    // Look for combinable terms
    for (let j = i + 1; j < terms.length; j++) {
      if (used.has(terms[j])) continue;

      const otherTags = getSemanticTags(terms[j]);

      // Same family = can combine
      if (sharesFamily(termTags, otherTags)) {
        // "neon" + "cyberpunk" → "neon cyberpunk"
        combined.push(`${terms[i]} ${terms[j]}`);
        used.add(terms[i]);
        used.add(terms[j]);
        break;
      }
    }

    if (!used.has(terms[i])) {
      combined.push(terms[i]);
      used.add(terms[i]);
    }
  }

  return combined;
}
```

### 7.3 Outlier Detection

Remove terms that don't fit with the majority.

```typescript
function findOutliers(terms: string[]): string[] {
  const familyCounts = new Map<string, number>();

  // Count family occurrences
  for (const term of terms) {
    const tags = getSemanticTags(term);
    for (const family of tags.families) {
      familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    }
  }

  // Find dominant family
  const dominantFamily = [...familyCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];

  // Terms not in dominant family are outliers
  return terms.filter((term) => {
    const tags = getSemanticTags(term);
    return !tags.families.includes(dominantFamily);
  });
}
```

---

## 8. Integration with Existing Features

### 8.1 Feature Compatibility Matrix

| #   | Feature                         | Status       | Integration Notes                                           |
| --- | ------------------------------- | ------------ | ----------------------------------------------------------- |
| 1   | 12-Category Dropdown System     | ✅ Unchanged | Dropdowns receive reordered options from intelligence layer |
| 2   | Platform-Aware Limits           | ✅ Enhanced  | Limits inform trim priority per platform                    |
| 3   | Aspect Ratio Selector           | ✅ Enhanced  | Can suggest AR based on subject (portrait → 2:3)            |
| 4   | Composition Mode Toggle         | ✅ Enhanced  | Dynamic mode uses context-aware composition terms           |
| 5   | Text Length Optimizer           | ✅ Enhanced  | Uses smart trim instead of position-based trim              |
| 6   | Anonymous 5-Try Feature         | ✅ Unchanged | No change to usage tracking                                 |
| 7   | Daily Usage Quotas              | ✅ Unchanged | No change                                                   |
| 8   | 5 Lock States                   | ✅ Unchanged | No change                                                   |
| 9   | 🎲 Randomise Button             | ✅ Enhanced  | Generates coherent prompts; respects user subject           |
| 10  | Clear All Button                | ✅ Unchanged | Clears everything including context                         |
| 11  | 42 Platform Adapters            | ✅ Enhanced  | Platform hints inform suggestions                           |
| 12  | Negative-to-Positive Conversion | ✅ Enhanced  | Smarter conversion based on context                         |
| 13  | Custom Entry Support            | ✅ Protected | Custom text always included, never trimmed                  |
| 14  | Copy Prompt                     | ✅ Unchanged | Copies intelligent output                                   |
| 15  | Open in Provider                | ✅ Unchanged | No change                                                   |
| 16  | Pro Enhanced Limits             | ✅ Enhanced  | Pro users get deeper suggestions                            |
| 17  | Auto-Trim                       | ✅ Enhanced  | Uses smart trim on platform switch                          |
| 18  | Length Indicator                | ✅ Enhanced  | Shows coherence % alongside char count                      |

### 8.2 Enhanced Randomise Behaviour

```typescript
function intelligentRandomise(
  currentSelections: PromptSelections,
  platformId: string,
): PromptSelections {
  const newSelections: PromptSelections = {};

  // RULE: If user has typed a subject, keep it
  if (currentSelections.subject?.customValue) {
    newSelections.subject = {
      selected: [],
      customValue: currentSelections.subject.customValue,
    };
  } else {
    // Pick random subject
    newSelections.subject = {
      selected: [pickRandom(getOptions("subject"))],
      customValue: "",
    };
  }

  // Determine style family from subject
  const subjectTags = getSemanticTags(
    newSelections.subject.customValue || newSelections.subject.selected[0],
  );
  const targetFamily = pickRandom(subjectTags.families) || pickRandomFamily();

  // Fill other categories coherently within family
  for (const category of CATEGORIES) {
    if (category === "subject") continue;

    const options = getOptions(category);
    const familyOptions = options.filter((opt) =>
      getSemanticTags(opt).families.includes(targetFamily),
    );

    // Pick from family-matched options, or fall back to any
    const pool = familyOptions.length > 0 ? familyOptions : options;
    const count = category === "negative" ? randomInt(2, 3) : 1;

    newSelections[category] = {
      selected: pickMultipleRandom(pool, count),
      customValue: "",
    };
  }

  return newSelections;
}
```

---

## 9. New Pages

### 9.1 Route Structure

```
src/app/
├── studio/
│   ├── playground/
│   │   ├── page.tsx                # Prompt Lab server component (data fetch)
│   │   └── playground-page-client.tsx  # Client wrapper (provider state)
│   └── library/
│       └── page.tsx            # Saved prompts grid (/studio/library)
├── prompts/
│   └── explore/
│       └── page.tsx            # Style family browser
└── (future)
    ├── learn/
    │   └── page.tsx            # Education hub
    └── trending/
        └── page.tsx            # Community trends (Phase 4)
```

**Route correction (18 March 2026):** The Prompt Lab was originally planned at `/prompts/playground` but was implemented at `/studio/playground`. The Library moved from `/prompts/library` to `/studio/library`. This doc now reflects the actual routes.

Insert after Section 9.1 (Route Structure), before Section 9.2 (Page Definitions)

9.1.1 Universal Page Layout
All Promagen pages share identical layout. Only the centre content changes.
Layout Structure (Every Page):
┌─────────────────────────────────────────────────────────────────────┐
│ PROMAGEN header │
├─────────────────────────────────────────────────────────────────────┤
│ Finance Ribbon (FX pairs) │
├──────────────┬─────────────────────────────────┬────────────────────┤
│ │ │ │
│ Left Rail │ CENTRE CONTENT │ Right Rail │
│ (Eastern │ (swaps per page) │ (Western │
│ Exchanges) │ │ Exchanges) │
│ │ │ │
├──────────────┴─────────────────────────────────┴────────────────────┤
│ Footer │
└─────────────────────────────────────────────────────────────────────┘
Implementation: All pages use HomepageGrid component with different centre prop.
What Stays Identical (Every Page):

PROMAGEN header
Finance Ribbon
Left rail (Eastern exchanges)
Right rail (Western exchanges)
Synchronized rail scrolling
Footer

What Changes:

| Route                 | Centre Content                              |
| --------------------- | ------------------------------------------- |
| `/`                   | AI Providers Leaderboard                    |
| `/providers/[id]`     | Prompt Builder (provider pre-selected)      |
| `/prompts/playground` | Prompt Builder (provider dropdown selector) |
| `/prompts/library`    | Saved Prompts Grid                          |
| `/prompts/explore`    | Style Family Browser                        |
| `/prompts/learn`      | Education Content                           |
| `/prompts/trending`   | Community Trends                            |

Non-Regression Rule: New pages must not modify HomepageGrid, exchange rails, Finance Ribbon, or footer. Only pass new centre content.

### 9.2 Page Definitions

#### `/studio/playground` — Prompt Lab (Pro Promagen exclusive)

| Aspect       | Detail                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Purpose      | Builder-first entry: Create prompts without pre-selecting a provider                                   |
| Content      | Full Prompt Builder with provider dropdown selector in header                                          |
| Features     | Provider switching (instant reformat); All intelligence features; Colour-coded prompts; 4-tier preview |
| Entry points | Pro page card 6 (🧪 Prompt Lab); Direct URL; "Prompt Lab" button in standard builder footer            |
| Exit points  | "Open in X" launches provider; Save → Library; Copy to clipboard                                       |
| Auth gate    | **Pro Promagen exclusive** — NOT YET GATED (see `paid_tier.md` §5.13)                                  |

**Key Difference from `/providers/[id]`:**

| Aspect    | `/providers/[id]`                     | `/studio/playground`                                |
| --------- | ------------------------------------- | --------------------------------------------------- |
| Header    | Static: "Midjourney · Prompt builder" | Dropdown: "[▼ Select Provider...] · Prompt builder" |
| Provider  | Pre-selected from URL                 | User selects from all 42                            |
| Use case  | "I want to use Midjourney"            | "I want to build a prompt"                          |
| Switching | Navigate to different URL             | Instant dropdown change                             |
| 4-tier    | N/A                                   | Shows all 4 tier prompts with colour coding         |
| Optimizer | Active when provider selected         | Disabled until provider selected (neutral mode)     |

**Provider Switching Behaviour:**

- Selections persist when switching providers
- Prompt auto-reformats for new provider's syntax
- Character limits adjust (excess auto-trimmed)
- "Open in X" button updates to selected provider

**Implementation:**

| File                                                            | Purpose                                                                                                                                                                                                 | Lines |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `src/app/studio/playground/page.tsx`                            | Server component (data fetch)                                                                                                                                                                           | 69    |
| `src/app/studio/playground/playground-page-client.tsx`          | Client wrapper (provider state)                                                                                                                                                                         | 135   |
| `src/components/prompts/playground-workspace.tsx`               | AI Disguise orchestrator (v3.0.0)                                                                                                                                                                       | 313   |
| `src/components/prompts/enhanced-educational-preview.tsx`       | Lab preview & AI Disguise wiring (v3.1.0), footer Clear All cascade via `clearSignal`                                                                                                                   | 2,014 |
| `src/components/prompt-builder/four-tier-prompt-preview.tsx`    | 4-tier colour-coded preview, "Generated for" badge, **tier provider icons strip**, **white tier labels**, `providers` prop                                                                              | 788   |
| `src/components/prompt-builder/intelligence-panel.tsx`          | **REMOVED from Prompt Lab render (23 Mar 2026).** Code file untouched — still used by standard builder. DnaBar conflict count still fed via simplified `useRealIntelligence`. See `ai-disguise.md` D11. | 515   |
| `src/components/prompt-builder/prompt-intelligence-builder.tsx` | Intelligence builder                                                                                                                                                                                    | 714   |

#### Prompt Lab AI Disguise Update (v3.0.0 — 23 March 2026)

The Prompt Lab now uses the AI Disguise system — 3 targeted GPT-5.4-mini API calls for prompt generation and optimisation, disguised as "1,001 proprietary algorithms". The IntelligencePanel has been removed from the Prompt Lab render (scored 52/100 for the AI Disguise workflow — designed for the dropdown-selection workflow, became a passive sidebar in the human-text-input workflow).

**Impact on intelligence system:**

- `usePromptAnalysis` hook still runs in the Lab — feeds DnaBar with `conflictCount`, `hasHardConflicts`, `healthScore`
- The `conflicts`, `suggestions`, `platformHints`, `weatherSuggestions` mappings are no longer computed (removed from `useRealIntelligence`)
- `handleSuggestionClick` and `handleMoodTermClick` callbacks removed
- Layout changed from `lg:grid-cols-3` (builder + intelligence panel) to full-width single column (`space-y-4`)
- The IntelligencePanel component file is untouched — it remains fully functional in the standard builder (`/providers/[id]`)

**Full specification:** `ai-disguise.md` v2.0.0. **Architecture:** `prompt-lab.md` v3.0.0.

#### Prompt Lab Parity Features (v5.0.0 — 18 March 2026)

The Prompt Lab now has full feature parity with the standard builder for colour-coded prompts and optimizer UX. These features are implemented in `enhanced-educational-preview.tsx` (2,014 lines):

**1. Colour-coded prompts in all 4 tiers:** `FourTierPromptPreview` receives `isPro` and `termIndex` props. When `isPro=true`, each tier card renders prompt text via `parsePromptIntoSegments()` with `CATEGORY_COLOURS` from `src/lib/prompt-colours.ts`.

**2. Assembled prompt box:** Full-width box between category grid and 4-tier cards showing `activeTierPromptText`. Colour-coded for Pro users. Inline `SaveIcon` + copy icons (float-right). `StageBadge` in header. Char count right-aligned.

**3. Dynamic label switching:** When `isOptimizerEnabled && selectedProviderId`:

- Label: "Assembled prompt" → "Optimized prompt in [Provider] [icon]" (`text-emerald-300`)
- Border: `border-slate-600` → `border-emerald-600/50 bg-emerald-950/20`
- Text: `text-slate-100` → `text-emerald-100`
- Copy tooltip: "Copy assembled prompt" → "Copy optimized prompt"
- **Note:** Condition does NOT include `wasOptimized` — switches the moment optimizer is enabled with a provider

**4. Provider icon on optimized label:** 20×20px provider icon next to "Optimized prompt in [ProviderName]". `onError` hides icon if missing.

**5. StageBadge:** Local component: 📋 Static / ✨ Dynamic / ⚡ Optimized / ✓ Optimal. In assembled prompt box header.

**6. Optimizer disabled in neutral mode:** When no provider is selected, the optimizer toggle is force-disabled. Tooltip: "Select an AI provider above to enable optimisation." When provider selected → real platform tooltip.

**7. Green "Within optimal range":** When optimizer ON + provider selected + no trimming: emerald bar "✓ Within optimal range — X chars / No trimming needed".

**8. LabCategoryColourLegend:** Same restyled design as standard builder's `CategoryColourLegend`. Positioned in header between `│` divider and Optimize toggle.

**9. Inline copy + save icons:** Copy + `SaveIcon` inside both assembled and optimized prompt boxes. Optimized box: `min-h-[60px] max-h-[150px]`.

**10. Lifetime counter wiring:** All 3 copy handlers call `incrementLifetimePrompts()`.

**11. cursor-pointer on all interactive elements:** Copy prompt, Randomise, Clear, Save footer buttons. Intelligence panel Conflicts/Suggestions tabs and weather suggestion buttons.

#### Prompt Lab UI Polish (v3.1.0 — 23 March 2026)

**12. Tier Provider Icons Strip:** `FourTierPromptPreview` now accepts a `providers` prop and shows all providers for the active tier as a centered icon row between the header and tier cards. Icons grouped via `getPlatformTierId()`. Styling matches PotM "Try in" icons: `bg-white/15 ring-1 ring-white/10`, `clamp(30px, 2.3vw, 38px)` squares, `drop-shadow(0 0 3px rgba(255,255,255,0.4))`. Non-clickable (`cursor-default`), hover glow + `scale(1.1)`. Educational — teaches users which providers belong to which tier family.

**13. White Tier Labels:** "Tier X: Name" and "Same scene, different syntaxes" text changed from `text-slate-500` to `text-white font-medium`. No grey text in Prompt Lab per code standard.

**14. Generate Button — Engine Bay Styling:** The Generate Prompt button in `DescribeYourImage` adopts the same visual treatment as the Launch Platform Builder button. When textarea has text: sky→emerald→indigo gradient, `dyi-generate-pulse` animation, shimmer overlay on hover. When empty: slate/disabled. Animations co-located in `DESCRIBE_STYLES`. See `buttons.md` §7.1.

**15. Purple Gradient Clear All Buttons:** Both top (next to Generate) and footer Clear All buttons use canonical purple gradient (`border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white`). Full cascade reset. Footer uses `clearSignal` mechanism to trigger DescribeYourImage internal reset. See `buttons.md` §7.2–§7.3.

**16. Call 2 Harmony Engineering:** The Call 2 system prompt evolved from 11 rules (scoring 62/100) to 18 rules (scoring 93/100) through 5 rounds of iterative testing. Post-processing layer added: P1 deduplicates T2 `--no` block, P2 strips T1 trailing periods. Temperature 0.3→0.5, max tokens 1500→2000. See `ai-disguise.md` §6–§8.

#### Colour Pipeline in Pro Page Preview Panels (v6.0.0 — 19 March 2026)

The colour-coded prompt pipeline extends beyond the builders to three Pro page preview panels:

**Dynamic consumers (use `parsePromptIntoSegments()` at runtime):**

- `DailyPromptsPreviewPanel` — parses assembled prompt from live PotM data via `sharedParsePrompt()` with a `termIndex` built from `categoryMap.selections`. Renders colour-coded assembled + optimized prompt boxes.
- `LabTierWindow` (inside `PromptLabPreviewPanel`) — parses per-tier prompt text via `labParsePrompt()` with `labBuildTermIndex()` from `tierCategoryMap`. Renders colour-coded prompt in each of the 4 rotating provider windows.

**Static consumer (uses hardcoded segment data):**

- `ImageGenPreviewPanel` — does NOT use `parsePromptIntoSegments()`. Instead, each of the 5 showcase prompts is pre-segmented into `{ text, color }[]` arrays using `IG_C` (a local alias of `CATEGORY_COLOURS` hex values). This is because the prompts are static marketing copy, not dynamically assembled. The segments are hand-categorised: environment terms in sky-400, lighting in amber, style in purple, etc.

**Why two patterns:** Dynamic parsing works when the prompt was assembled by `assemblePrompt()` and a `categoryMap` is available to build a `termIndex`. Static segments are used when the prompt text is predetermined and the categorisation is editorial (human-decided, not algorithm-decided).

#### `/prompts/library` — Your Saved Prompts

| Aspect       | Detail                                                             |
| ------------ | ------------------------------------------------------------------ |
| Purpose      | Save, organise, and reload prompts                                 |
| Content      | Grid of saved prompt cards with DNA preview                        |
| Features     | Filter by platform, style family, coherence; Search; Remix; Delete |
| Entry points | Save button in Prompt Builder; Site nav                            |
| Exit points  | Click card → loads into Prompt Builder                             |

#### `/prompts/explore` — Style Explorer

| Aspect       | Detail                                                               |
| ------------ | -------------------------------------------------------------------- |
| Purpose      | Visual discovery of style families and moods                         |
| Content      | Family cards; Mood mapping; Visual browser                           |
| Features     | Click family → see all members; Build prompt visually; "Surprise me" |
| Entry points | "Explore styles" link in Prompt Builder; Site nav                    |
| Exit points  | "Open in Builder" → loads selections into Prompt Builder             |

#### `/prompts/learn` — Prompt Academy

| Aspect       | Detail                                                                          |
| ------------ | ------------------------------------------------------------------------------- |
| Purpose      | Education hub — how to build great prompts                                      |
| Content      | Guides; Conflict explanations; Platform differences; Interactive examples       |
| Sections     | Getting Started; Style Families; Common Mistakes; Platform Guide; Advanced Tips |
| Entry points | Help icon in Prompt Builder; Conflict warning "Learn why"; Site nav             |
| Exit points  | "Try it" buttons → Prompt Builder with preloaded example                        |

#### `/prompts/trending` — Community Trends (Phase 4)

| Aspect       | Detail                                                     |
| ------------ | ---------------------------------------------------------- |
| Purpose      | Show what's popular across all users                       |
| Content      | Trending combinations; Rising styles; Platform leaderboard |
| Data         | Anonymous, aggregated (no user data exposed)               |
| Entry points | "Trending" suggestions in Prompt Builder; Site nav         |
| Exit points  | Click trend → loads into Prompt Builder                    |

### 9.3 Navigation Structure

```
PROMAGEN
├── Homepage (/)
├── Providers (/providers)
│   └── [Provider] Prompt Builder (/providers/[id])  ← Provider-first flow
│
├── Studio (/studio)  ← CREATIVE TOOLS
│   ├── Prompt Lab (/studio/playground)  ← Builder-first flow (Pro exclusive)
│   └── Library (/studio/library)  ← Saved prompts
│
├── Prompts (/prompts)
│   └── Explore (/prompts/explore)  ← Style family browser
│
├── World Context (/world-context)  ← Exchange detail page
├── Pro Promagen (/pro-promagen)  ← Config + upgrade page
│
└── (Future)
    ├── Learn (/prompts/learn)
    └── Trending (/prompts/trending)
```

### 9.4 Connection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOMEPAGE                                 │
│                            /                                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│      PROVIDERS TABLE        │   │        PLAYGROUND           │
│        /providers           │   │    /prompts/playground      │
│                             │   │                             │
│  Click provider row ────┐   │   │  Provider-first: Click row  │
└─────────────────────────┼───┘   │  Builder-first: Dropdown    │
                          │       └──────────────┬──────────────┘
                          │                      │
                          ▼                      │
┌─────────────────────────────────────────────────────────────────┐
│                     PROMPT BUILDER                               │
│         /providers/[id]  OR  /prompts/playground                │
│                                                                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │ 💾 Save     │  │ 🎨 Explore  │  │ ❓ Help     │            │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
└──────────┼────────────────┼────────────────┼────────────────────┘
           │                │                │
           ▼                ▼                ▼
    ┌────────────┐   ┌────────────┐   ┌────────────┐
    │  LIBRARY   │   │  EXPLORE   │   │   LEARN    │
    │  /prompts/ │   │  /prompts/ │   │  /prompts/ │
    │  library   │   │  explore   │   │  learn     │
    └─────┬──────┘   └─────┬──────┘   └─────┬──────┘
          │                │                │
          └────────────────┴────────────────┘
                           │
                    Load into Builder
                           │
                           ▼
                  ┌────────────────┐
                  │ PROMPT BUILDER │
                  │ (either route) │
                  └────────────────┘
```

---

## 10. UI Additions to Prompt Builder

**Layout remains unchanged.** These are small additions within existing structure.

### 10.1 Header Row Additions

| Element            | Location              | Behaviour                                     |
| ------------------ | --------------------- | --------------------------------------------- |
| Market Mood toggle | After Optimize toggle | `[Market Mood 📈]` — toggles market influence |
| Coherence badge    | Near char count       | `78% coherent` or `⚠️ 2 conflicts`            |

### 10.2 Dropdown Enhancements

| Element           | Location                 | Behaviour                                 |
| ----------------- | ------------------------ | ----------------------------------------- |
| Reordered options | Within existing dropdown | Most relevant options float to top        |
| Relevance hint    | Option suffix (subtle)   | `cyberpunk ●●●` (3 dots = high relevance) |

### 10.3 Category Additions

| Element          | Location               | Behaviour                     |
| ---------------- | ---------------------- | ----------------------------- |
| Suggested chips  | Below each dropdown    | 2-3 context-aware suggestions |
| Conflict warning | Inline with selections | `⚠️` icon on conflicting chip |

### 10.4 Preview Area Additions

| Element        | Location                 | Behaviour                             |
| -------------- | ------------------------ | ------------------------------------- |
| Prompt DNA bar | Below "Assembled prompt" | `[██ ██ ██ ░░ ██ ░░ ...]` visual fill |
| Coherence %    | Next to DNA bar          | `78% coherent`                        |

### 10.5 Action Row Additions

| Element       | Location         | Behaviour                    |
| ------------- | ---------------- | ---------------------------- |
| Save button   | Near Copy button | `💾` icon — saves to Library |
| Library count | Near Save        | `📚 (3)` — shows saved count |

---

## 11. Build Phases

### Phase 1: Foundation Data (Week 1)

| Day | Task                                    | Output                                |
| --- | --------------------------------------- | ------------------------------------- |
| 1   | Define `families.json` structure        | ~20 family definitions                |
| 1   | Define `semantic-tags.json` schema      | TypeScript types                      |
| 2   | Tag Subject options (~100)              | semantic-tags.json partial            |
| 2   | Tag Style options (~100)                | semantic-tags.json partial            |
| 3   | Tag Lighting, Colour, Atmosphere (~150) | semantic-tags.json partial            |
| 3   | Define `conflicts.json`                 | ~50 conflict pairs                    |
| 4   | Tag remaining categories (~150)         | semantic-tags.json complete (Phase 1) |
| 5   | Review + test data integrity            | All JSON validates                    |

**Deliverable:** ~500 options tagged (25% coverage, highest impact)

### Phase 2: Core Intelligence Engine (Week 2)

| Day | Task                     | Output                               |
| --- | ------------------------ | ------------------------------------ |
| 1   | Build `parser.ts`        | Extracts keywords from user text     |
| 1   | Build `scorer.ts`        | Scores option relevance (0-100)      |
| 2   | Build `reorder.ts`       | Returns sorted options by score      |
| 2   | Wire reorder to Combobox | Live reordering works                |
| 3   | Build `trim.ts` (smart)  | Trims by relevance, not position     |
| 3   | Build `combine.ts`       | Merges similar terms                 |
| 4   | Integrate Subject Anchor | User subject always first, protected |
| 4   | Protect all custom text  | customValue never trimmed            |
| 5   | Integration testing      | All paths work together              |

**Deliverable:** Working intelligence engine

### Phase 3: Existing Feature Integration (Week 3)

| Day | Task                                  | Integrates With       |
| --- | ------------------------------------- | --------------------- |
| 1   | Smart Randomise                       | 🎲 Randomise Button   |
| 1   | Randomise respects user Subject       | Subject protection    |
| 2   | Text Length Optimizer uses smart trim | Text Length Optimizer |
| 2   | Auto-Trim uses smart trim             | Auto-Trim             |
| 3   | Build `conflicts.ts`                  | Conflict Detection    |
| 3   | Conflict warning UI                   | Warning badges        |
| 4   | Platform-Aware trim weighting         | Platform-Aware Limits |
| 5   | Regression test all 18 features       | Full verification     |

**Deliverable:** All features enhanced, no regressions

### Phase 4: Market Bridge (Week 4)

| Day | Task                        | Output                      |
| --- | --------------------------- | --------------------------- |
| 1   | Build `market-mood.ts`      | Reads Market Pulse state    |
| 1   | Connect to existing FX data | Gets volatility, direction  |
| 2   | Build mood → boost mapping  | market-moods.json applied   |
| 2   | Market Mood toggle UI       | Toggle in header            |
| 3   | Tint suggestions when ON    | Suggestions reflect market  |
| 3   | "Inspired by markets" badge | Badge on copied prompt      |
| 4   | Test with live transitions  | Market Pulse triggers work  |
| 5   | Polish + edge cases         | Handles market closed, etc. |

**Deliverable:** Market Mood feature complete

### Phase 5: Education Layer (Week 5)

| Day | Task                    | Output                       |
| --- | ----------------------- | ---------------------------- |
| 1   | Build `dna.ts`          | Calculates coherence score   |
| 1   | DNA bar component       | Visual category fill         |
| 2   | Coherence % calculation | 0-100% score                 |
| 2   | Colour coding           | Green/amber/red per category |
| 3   | Build `suggestions.ts`  | Suggested chip data          |
| 3   | Suggested chips UI      | Chips below dropdowns        |
| 4   | Tooltip explanations    | "Why this?" hover            |
| 5   | Polish animations       | Smooth transitions           |

**Deliverable:** Education layer complete

### Phase 6: Full Tag Coverage (Week 6)

| Day | Task                         | Output                  |
| --- | ---------------------------- | ----------------------- |
| 1-3 | Tag remaining ~1,500 options | 100% coverage           |
| 4   | Expand conflict definitions  | Comprehensive conflicts |
| 5   | Tune scoring weights         | Optimised algorithm     |

**Deliverable:** Complete data coverage

### Phase 7: New Pages (Weeks 7-8)

| Week | Pages              | Priority                   |
| ---- | ------------------ | -------------------------- |
| 7    | `/prompts/library` | Core — save/reload         |
| 7    | `/prompts/learn`   | Education — differentiator |
| 8    | `/prompts/explore` | Discovery — style browser  |
| 8    | Settings modal     | Intelligence preferences   |

**Deliverable:** All pages functional

### Phase 8: Community Features (Later)

| Feature                  | Description                 |
| ------------------------ | --------------------------- |
| Anonymous trend tracking | What combos get copied most |
| Platform success hints   | Known platform behaviours   |
| Remix feature            | Generate variations         |
| Saved prompt sharing     | Share DNA signatures        |

---

## 12. Files Modified (Existing) + New Files

### Modified Files

| File                                                            | Changes                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/prompt-builder.ts`                                     | Import intelligence; use smart trim; Subject anchor; `selectionsFromMap()`                                                                                                                                                                                                                                                              |
| `src/hooks/use-prompt-optimization.ts`                          | Use smart trim; protect custom text                                                                                                                                                                                                                                                                                                     |
| `src/components/providers/prompt-builder.tsx`                   | DNA bar; conflict warnings; colour-coded prompts; legend; lifetime counter (v11.0.0, 3,104 lines)                                                                                                                                                                                                                                       |
| `src/components/ui/combobox.tsx`                                | `labelColour` prop (v7.3.0, 811 lines); reordered options; relevance hints                                                                                                                                                                                                                                                              |
| `src/components/prompts/enhanced-educational-preview.tsx`       | Lab parity + AI Disguise wiring: colour-coding, assembled box, dynamic label, StageBadge, optimizer neutral mode, Call 3 wiring, AlgorithmCycling, effective optimised values, IntelligencePanel removed, full-width layout, **footer Clear All cascade via `clearSignal`**, **purple gradient Clear All button** (v3.1.0, 2,014 lines) |
| `src/components/prompt-builder/four-tier-prompt-preview.tsx`    | `isPro` + `termIndex` props for colour-coded rendering, "Generated for" badge, **tier provider icons strip** (`TierProviderIcons` component, `providers` prop), **white tier labels** (`text-white font-medium`) (v3.1.0, 788 lines)                                                                                                    |
| `src/components/prompt-builder/intelligence-panel.tsx`          | cursor-pointer on Conflicts/Suggestions/Market Mood tabs (515 lines). **REMOVED from Prompt Lab render (23 Mar 2026) — retained in standard builder only.**                                                                                                                                                                             |
| `src/components/prompt-builder/prompt-intelligence-builder.tsx` | `colourTermIndex` computation, passes to FourTierPromptPreview (714 lines)                                                                                                                                                                                                                                                              |
| `src/app/pro-promagen/pro-promagen-client.tsx`                  | Colour pipeline consumer: DailyPromptsPreviewPanel (dynamic), LabTierWindow (dynamic), ImageGenPreviewPanel (static `IG_C` segments) (v6.0.0, 3,560 lines)                                                                                                                                                                              |

### New Files (v5.0.0)

| File                          | Purpose                                               | Lines |
| ----------------------------- | ----------------------------------------------------- | ----- |
| `src/lib/prompt-colours.ts`   | SSOT: 13 category colours, labels, emojis, parser     | 210   |
| `src/lib/lifetime-counter.ts` | `incrementLifetimePrompts()` + `getLifetimePrompts()` | 33    |

---

## 13. Testing Requirements

### Unit Tests

| Module         | Tests                                                      |
| -------------- | ---------------------------------------------------------- |
| `scorer.ts`    | Relevance calculation; family matching; conflict penalties |
| `reorder.ts`   | Options sorted correctly; context sensitivity              |
| `trim.ts`      | Protected text survives; lowest relevance trimmed first    |
| `combine.ts`   | Similar terms merge; different terms preserved             |
| `conflicts.ts` | Known conflicts detected; soft conflicts flagged           |
| `dna.ts`       | Coherence calculation accurate; category fill correct      |

### Integration Tests

| Scenario                               | Expected                                     |
| -------------------------------------- | -------------------------------------------- |
| User types subject → dropdowns reorder | Relevant options float to top                |
| Prompt over limit → smart trim         | User text preserved; low relevance trimmed   |
| Conflicting selections                 | Warning badge appears                        |
| 🎲 Randomise with user subject         | Subject preserved; other categories coherent |
| Platform switch → auto trim            | Most relevant terms kept                     |
| Market Mood ON → suggestions           | Market-tinted options boosted                |

### Regression Tests

All 18 existing features verified after each phase.

---

## 14. Success Metrics

| Metric             | Target                      | How to Measure                         |
| ------------------ | --------------------------- | -------------------------------------- |
| Prompt coherence   | Average DNA score > 75%     | Track score on all copied prompts      |
| Conflict reduction | < 5% prompts with conflicts | Count warnings shown vs prompts copied |
| Feature adoption   | > 30% users try Market Mood | Toggle analytics                       |
| User learning      | Coherence improves per user | Track score trend per user over time   |
| Engagement         | Users save prompts          | Library usage analytics                |

---

## 15. Non-Regression Rule

When modifying for Prompt Intelligence:

- Do NOT change Prompt Builder layout or visual design
- Do NOT change existing dropdown behaviour (only enhance with reordering)
- Do NOT change Copy/Open button behaviour
- Do NOT change authentication or usage tracking
- Do NOT change platform adapter output formats
- Preserve all 18 existing features
- **Do NOT duplicate CATEGORY_COLOURS — use `src/lib/prompt-colours.ts` as sole SSOT**
- **Do NOT add `wasOptimized` to the dynamic label condition — it switches on optimizer enable, not on trimming**
- **Do NOT remove `incrementLifetimePrompts()` from any copy handler**
- **Do NOT remove cursor-pointer from intelligence panel tabs** (standard builder only — panel removed from Prompt Lab)
- **Four-tier-prompt-preview `isPro` and `termIndex` props must be passed through from parent — do NOT hardcode**
- **Optimizer neutral mode: when `!selectedProviderId`, force-disable optimizer — do NOT allow enabling without a provider**
- **Prompt Lab route is `/studio/playground` — do NOT use the legacy `/prompts/playground` path**
- **ImageGenPreviewPanel uses static `IG_C` segments — do NOT convert to dynamic `parsePromptIntoSegments()` (the prompts are editorial, not assembled)**
- **IntelligencePanel is REMOVED from Prompt Lab render — do NOT re-add. DnaBar still fed via simplified `useRealIntelligence`. Panel remains in standard builder only. See `ai-disguise.md` D11.**
- **Tier provider icons are non-clickable** — `cursor-default`, `div` not `button`. Hover glow + scale only. Do not add click handlers. See `prompt-lab.md` §10.
- **Tier labels are `text-white font-medium`** — not `text-slate-500`. No grey text in Prompt Lab.
- **Generate button must match engine bay styling** — `dyi-generate-pulse` and `dyi-generate-shimmer` copied from engine bay source. Do not diverge. See `buttons.md` §7.1.
- **Both Clear All buttons use purple gradient with `text-white`** — not Core Colours. See `buttons.md` §7.2–§7.3.
- **Post-processing is mandatory on Call 2 responses** — `postProcessTiers()` must run before returning to client. See `ai-disguise.md` §7.
- **`usePromptAnalysis` still runs in Lab for DnaBar — do NOT remove the simplified `useRealIntelligence` hook from `enhanced-educational-preview.tsx`**

**Existing features preserved:** Yes (required for every change)

---

## Changelog

- **6 Apr 2026 (v3.0.0):** Updated from src.zip SSoT. Header rewritten: scope clarified as client-side standard builder only (NOT the Prompt Lab AI engine). Cross-references updated to current versions (ai-disguise v5.0.0, prompt-lab v4.0.0, prompt-optimizer v6.0.0, paid_tier v8.0.0). Added builder-quality-intelligence v3.0.0 cross-ref. §4.5 Gallery Mode marked as SUPERSEDED — concept evolved into Scene Starters + Prompt Showcase, no `/gallery` route exists. Added scope disambiguation note to §2 Client-Side Design. Removed accidentally appended "Weather Description → City Prompt Fix" section (stale patch notes that don't belong in the authority doc).
- **23 Mar 2026 (v2.3.0):** Prompt Lab UI Polish + Harmony Engineering refs. Cross-references updated. Features 12–16 added to §9. File tables updated.
- **23 Mar 2026 (v2.2.0):** AI Disguise integration — IntelligencePanel removed from Prompt Lab render. Standard builder retains it.
- **19 Mar 2026 (v2.1.0):** Colour pipeline extension to Pro page previews.
- **18 Mar 2026 (v2.0.0):** Prompt Lab Parity + colour-coded intelligence + route correction.
- **7 Jan 2026 (v1.0.0):** Initial document.

---

_This document is the authority for the client-side Prompt Intelligence system (standard prompt builder). For the Prompt Lab AI engine (Call 1/2/3), see `ai-disguise.md` v5.0.0 and `prompt-lab.md` v4.0.0. `src.zip` is the Single Source of Truth._
