# Prompt Intelligence

**Last updated:** 8 January 2026  
**Owner:** Promagen  
**Authority:** This document defines the architecture, data structures, and implementation plan for the Prompt Intelligence system.

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

All intelligence runs in the browser. No server calls for scoring or suggestions.

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
  mood?: 'calm' | 'intense' | 'neutral' | 'eerie' | 'joyful';
  era?: 'past' | 'present' | 'future' | 'timeless';
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
      "members": ["cyberpunk", "futuristic", "neon", "holographic", "chrome", "dystopian"],
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
        "atmosphere": ["chaotic", "dynamic", "turbulent", "intense", "electric"],
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

## 4.5 Gallery Mode Integration (NEW v2.1.0)

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
  storm: ['dramatic', 'intense', 'electric'],
  thunder: ['dramatic', 'intense', 'electric'],
  rain: ['moody', 'reflective', 'glistening'],
  drizzle: ['moody', 'reflective', 'glistening'],
  snow: ['serene', 'pristine', 'cold'],
  fog: ['mysterious', 'ethereal', 'diffused'],
  mist: ['mysterious', 'ethereal', 'diffused'],
  cloud: ['overcast', 'soft light'],
  clear: ['vibrant', 'bright', 'warm'],
  sunny: ['vibrant', 'bright', 'warm'],
};

function weatherToAtmosphere(conditions: string): string[] {
  const lower = conditions.toLowerCase();
  for (const [key, atmosphere] of Object.entries(WEATHER_ATMOSPHERE_MAP)) {
    if (lower.includes(key)) return atmosphere;
  }
  return ['vibrant', 'bright', 'warm']; // Default: clear
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
  const allTerms = [brief.lighting, brief.style, ...brief.atmosphere, ...brief.motifs].filter(
    Boolean,
  );

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
  universal: 'text, logos, watermarks, words, letters, signatures',
  safety: 'political symbols, gore, explicit content, nudity, real people',
  quality: 'distorted faces, extra limbs, blurry, low quality, artifacts',
};

function getNegativePrompt(tier: PromptTier): string {
  const parts = [GALLERY_NEGATIVE_PROMPTS.universal, GALLERY_NEGATIVE_PROMPTS.safety];

  // Add quality negatives for CLIP-based platforms
  if (tier === 'tier1' || tier === 'tier2') {
    parts.push(GALLERY_NEGATIVE_PROMPTS.quality);
  }

  return parts.join(', ');
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
  const dominantFamily = [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

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
      selected: [pickRandom(getOptions('subject'))],
      customValue: '',
    };
  }

  // Determine style family from subject
  const subjectTags = getSemanticTags(
    newSelections.subject.customValue || newSelections.subject.selected[0],
  );
  const targetFamily = pickRandom(subjectTags.families) || pickRandomFamily();

  // Fill other categories coherently within family
  for (const category of CATEGORIES) {
    if (category === 'subject') continue;

    const options = getOptions(category);
    const familyOptions = options.filter((opt) =>
      getSemanticTags(opt).families.includes(targetFamily),
    );

    // Pick from family-matched options, or fall back to any
    const pool = familyOptions.length > 0 ? familyOptions : options;
    const count = category === 'negative' ? randomInt(2, 3) : 1;

    newSelections[category] = {
      selected: pickMultipleRandom(pool, count),
      customValue: '',
    };
  }

  return newSelections;
}
```

---

## 9. New Pages

### 9.1 Route Structure

```
src/app/prompts/
├── layout.tsx              # Shared prompts section layout
├── page.tsx                # /prompts → redirects to /prompts/library
├── playground/
│   └── page.tsx            # Standalone prompt builder with provider selector
├── library/
│   └── page.tsx            # Saved prompts grid
├── explore/
│   └── page.tsx            # Style family browser
├── learn/
│   └── page.tsx            # Education hub
└── trending/
    └── page.tsx            # Community trends (Phase 4)
```

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

#### `/prompts/playground` — Prompt Playground

| Aspect       | Detail                                                                            |
| ------------ | --------------------------------------------------------------------------------- |
| Purpose      | Builder-first entry: Create prompts without pre-selecting a provider              |
| Content      | Full Prompt Builder with provider dropdown selector in header                     |
| Features     | Provider switching (instant reformat); All intelligence features; Live comparison |
| Entry points | Direct bookmark; Site nav; "Build a prompt" CTAs                                  |
| Exit points  | "Open in X" launches provider; Save → Library; Copy to clipboard                  |

**Key Difference from `/providers/[id]`:**

| Aspect    | `/providers/[id]`                     | `/prompts/playground`                               |
| --------- | ------------------------------------- | --------------------------------------------------- |
| Header    | Static: "Midjourney · Prompt builder" | Dropdown: "[▼ Select Provider...] · Prompt builder" |
| Provider  | Pre-selected from URL                 | User selects from all 42                            |
| Use case  | "I want to use Midjourney"            | "I want to build a prompt"                          |
| Switching | Navigate to different URL             | Instant dropdown change                             |

**Provider Switching Behaviour:**

- Selections persist when switching providers
- Prompt auto-reformats for new provider's syntax
- Character limits adjust (excess auto-trimmed)
- "Open in X" button updates to selected provider

**Implementation:**

- Uses `PlaygroundWorkspace` component (client)
- Passes `providerSelector` prop to `PromptBuilder`
- Uses `Combobox` component with `compact` mode for header selector

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
├── Prompts (/prompts)  ← NEW SECTION
│   ├── Playground (/prompts/playground)  ← Builder-first flow
│   ├── Library (/prompts/library)
│   ├── Explore (/prompts/explore)
│   ├── Learn (/prompts/learn)
│   └── Trending (/prompts/trending)
│
└── Settings (/settings)
    └── Prompt Intelligence (/settings/prompt-intelligence)
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

## 12. Files Modified (Existing)

| File                                          | Changes                                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/prompt-builder.ts`                   | Import intelligence; use smart trim; Subject anchor                 |
| `src/hooks/use-prompt-optimization.ts`        | Use smart trim; protect custom text                                 |
| `src/components/providers/prompt-builder.tsx` | Add Market Mood toggle; DNA bar; suggested chips; conflict warnings |
| `src/components/ui/combobox.tsx`              | Accept reordered options; display relevance hints                   |

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

**Existing features preserved:** Yes (required for every change)

---

## Changelog

- **7 Jan 2026 (v1.0.0):** Initial document. Defines Prompt Intelligence architecture, data structures, scoring algorithm, integration plan, new pages, and build phases.
