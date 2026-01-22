# Shared Vocabulary Layer

> **Reusable building blocks for prompt construction**
> 
> The connective tissue that makes prompts flow naturally across all domains.

## Overview

The Shared Layer provides universal vocabulary elements that can be combined with domain-specific terms from `prompt-builder/` and `weather/`. These are the adjectives, intensifiers, and connectors that glue prompts together.

## Files

| File | Options | Purpose |
|------|---------|---------|
| `adjectives.json` | 420+ | Descriptive words in 17 categories |
| `intensifiers.json` | 220+ | Strength/emphasis modifiers |
| `connectors.json` | 280+ | Linking phrases and transitions |

**Total: 920+ reusable terms**

---

## Adjectives (420+)

Organized into 17 semantic categories:

| Category | Count | Examples |
|----------|-------|----------|
| `size` | 30 | tiny, massive, towering, boundless |
| `age` | 35 | ancient, vintage, contemporary, futuristic |
| `temperature` | 42 | frigid, warm, scorching, tropical |
| `texture` | 55 | smooth, rough, silky, weathered |
| `shape` | 48 | circular, angular, organic, fractured |
| `weight` | 32 | weightless, dense, hefty, ethereal |
| `brightness` | 45 | dark, radiant, glowing, iridescent |
| `color_quality` | 38 | muted, vibrant, neon, metallic |
| `mood_positive` | 48 | joyful, serene, magical, triumphant |
| `mood_negative` | 48 | melancholic, ominous, terrifying, lonely |
| `mood_neutral` | 35 | contemplative, mysterious, nostalgic |
| `energy` | 54 | still, dynamic, explosive, pulsing |
| `complexity` | 40 | simple, intricate, ornate, chaotic |
| `quality` | 48 | pristine, worn, ruined, corroded |
| `authenticity` | 40 | authentic, handmade, synthetic, artificial |
| `spatial` | 45 | central, peripheral, floating, grounded |
| `material_quality` | 54 | transparent, reflective, metallic, fabric |

### Usage

```typescript
import { getAdjectives, getRandomAdjective, getAdjectivesForMood } from '@/data/vocabulary/shared';

// Get all adjectives in a category
const textures = getAdjectives('texture');
// ['smooth', 'silky', 'rough', 'weathered', ...]

// Get random adjective
const randomTexture = getRandomAdjective('texture');
// 'velvety'

// Get mood-appropriate adjectives
const darkMood = getAdjectivesForMood('negative');
// ['melancholic', 'ominous', 'eerie', ...]
```

---

## Intensifiers (220+)

Organized by **strength level** and **effect type**:

### By Strength

| Level | Value | Examples | Usage |
|-------|-------|----------|-------|
| `minimal` | 0.1 | barely, faintly, hint of | Subtle effects |
| `slight` | 0.3 | slightly, gently, moderately | Toned down |
| `moderate` | 0.5 | fairly, quite, noticeably | Standard |
| `strong` | 0.7 | very, highly, remarkably | Emphasis |
| `intense` | 0.85 | extremely, incredibly, powerfully | Dramatic |
| `maximum` | 1.0 | absolutely, utterly, impossibly | Maximum impact |

### By Effect

| Effect | Purpose | Examples |
|--------|---------|----------|
| `emphasis` | Importance | primarily, crucially, prominently |
| `precision` | Exactness | precisely, meticulously, perfectly |
| `authenticity` | Genuineness | truly, genuinely, faithfully |
| `temporal` | Duration | eternally, momentarily, gradually |
| `spatial` | Coverage | everywhere, deeply, superficially |
| `quality` | Excellence | beautifully, masterfully, crudely |
| `emotional` | Impact | hauntingly, warmly, passionately |

### Prompt-Specific Intensifiers

| Type | Examples |
|------|----------|
| `detail` | highly detailed, ultra detailed, meticulously detailed |
| `quality` | best quality, premium quality, museum quality |
| `style` | in the style of, heavily inspired by, pure |
| `realism` | photorealistic, hyperrealistic, lifelike |
| `artistic` | highly stylized, expressively rendered |

### Usage

```typescript
import { getIntensifiers, getIntensifierForStrength, getPromptIntensifiers } from '@/data/vocabulary/shared';

// Get by strength level
const strong = getIntensifiers('intense');
// ['extremely', 'incredibly', 'powerfully', ...]

// Get for target strength (0.0-1.0)
const modifier = getIntensifierForStrength(0.8);
// 'exceptionally' (randomly selected from 'intense' level)

// Get prompt-specific
const quality = getPromptIntensifiers('quality');
// ['best quality', 'highest quality', 'premium quality', ...]
```

---

## Connectors (280+)

Organized by **function** (what they connect):

| Function | Count | Examples | Use Case |
|----------|-------|----------|----------|
| `featuring` | 18 | featuring, with, showcasing | Subject → Elements |
| `style_reference` | 24 | in the style of, inspired by, à la | Subject → Style |
| `location` | 35 | in, standing in, surrounded by | Subject → Environment |
| `background` | 22 | against a backdrop of, framed by | Subject → Background |
| `lighting` | 24 | lit by, bathed in, glowing with | Subject → Lighting |
| `atmosphere` | 20 | shrouded in, enveloped in, evoking | Subject → Mood |
| `wearing` | 22 | wearing, dressed in, adorned in | Character → Clothing |
| `action` | 22 | while, caught, in the act of | Subject → Action |
| `temporal` | 22 | during, from the era of, at the moment of | Subject → Time |
| `comparison` | 22 | like, resembling, blending | Element ↔ Element |
| `contrast` | 22 | contrasted with, juxtaposed with, despite | Element vs Element |
| `addition` | 22 | and, enhanced by, complemented by | Add elements |
| `technique` | 20 | rendered in, created with, painted in | Subject → Medium |
| `quality` | 18 | at, rendered at, worthy of | Subject → Quality |
| `perspective` | 18 | seen from, from the viewpoint of | Subject → View |
| `composition` | 16 | arranged in, forming, leading to | Compositional |

### Prompt Templates

Pre-built templates using connectors:

```typescript
import { getPromptTemplate } from '@/data/vocabulary/shared';

const portrait = getPromptTemplate('basic_portrait');
// {
//   template: "[subject] [wearing] [clothing], [location] [environment]...",
//   example: "woman dressed in Victorian gown, standing in misty garden..."
// }
```

### Platform Optimization

```typescript
import { getConnectorsForPlatform, formatForPlatform } from '@/data/vocabulary/shared';

// Get platform-specific advice
const mjConnectors = getConnectorsForPlatform('midjourney');
// { preferred: ['with', 'featuring', ...], avoid: ['4k', '8k', ...] }

// Format elements for platform
const formatted = formatForPlatform(
  ['portrait', 'dramatic lighting', 'oil painting'],
  'stable-diffusion'
);
// "portrait, dramatic lighting, oil painting"
```

---

## Building Prompts

### Intensified Adjective

```typescript
import { buildIntensifiedAdjective } from '@/data/vocabulary/shared';

const phrase = buildIntensifiedAdjective('detailed', 'intense');
// "incredibly detailed" or "extremely detailed"
```

### Connect Elements

```typescript
import { connectElements } from '@/data/vocabulary/shared';

const phrase = connectElements('warrior', 'ancient ruins', 'location');
// "warrior standing in ancient ruins" or "warrior surrounded by ancient ruins"
```

### Build Complete Phrase

```typescript
import { buildPhrase } from '@/data/vocabulary/shared';

const phrase = buildPhrase('portrait', 'lighting', 'golden sunlight', 'strong');
// "portrait bathed in very golden sunlight"
```

---

## Integration Example

```typescript
import { 
  getAdjectives, 
  getIntensifiers, 
  getConnectors,
  formatForPlatform 
} from '@/data/vocabulary/shared';

import { getOptions } from '@/data/vocabulary/prompt-builder';

function generatePrompt(platform: 'stable-diffusion' | 'midjourney' | 'dall-e') {
  const subject = getOptions('subject')[Math.floor(Math.random() * 100)];
  const mood = getAdjectives('mood_positive')[Math.floor(Math.random() * 20)];
  const intensifier = getIntensifiers('strong')[0];
  const style = getOptions('style')[Math.floor(Math.random() * 100)];
  const styleConnector = getConnectors('style_reference')[0];
  
  const elements = [
    subject,
    `${intensifier} ${mood} atmosphere`,
    `${styleConnector} ${style}`
  ];
  
  return formatForPlatform(elements, platform);
}

generatePrompt('stable-diffusion');
// "portrait of a woman, very serene atmosphere, in the style of impressionist"
```

---

## Statistics

```typescript
import { getSharedStats } from '@/data/vocabulary/shared';

const stats = getSharedStats();
// {
//   adjectives: 420,
//   intensifiers: 220,
//   connectors: 280,
//   total: 920
// }
```

---

## Changelog

### v1.0.0 (2026-01-21)
- Initial shared layer with 3 JSON files
- 420+ adjectives in 17 semantic categories
- 220+ intensifiers by strength and effect
- 280+ connectors by function
- Platform-optimized connector recommendations
- Prompt templates and building helpers
- Comprehensive TypeScript utilities
