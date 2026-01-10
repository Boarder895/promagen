# WorldPrompt — The Global Creative Engine

**Last updated:** 9 January 2026  
**Owner:** Promagen  
**Status:** Vision Document — Ready for Implementation  
**Authority:** This document defines the philosophy, architecture, and data requirements for Promagen's ambient global creativity system.

---

## Executive Summary

Promagen is not a prompt tool with stock exchanges bolted on.

Promagen is **ambient global awareness as creative fuel**.

The world never sleeps. Markets open and close. The sun rises and sets. Moons wax and wane. Commodities flow. Weather changes. Events unfold. All of this — every moment, everywhere — is fuel for imagination.

**The 10-second hook:** The user lands on Promagen and sees the prompt builder already knows something about the world they didn't tell it.

---

## Part 1: The Philosophy

### 1.1 The Bridge Between Markets and Imagination

Promagen's tagline is "a bridge between finance and AI creativity." This is not metaphor — it's mechanics.

| Finance Element | Creative Translation |
|-----------------|---------------------|
| Stock exchanges | **Place anchors** — Sydney isn't abstract, it's 28°C, ASX open, morning light |
| Market open/close | **Energy states** — cities waking, cities sleeping |
| FX movement | **Mood indicators** — currencies rising = optimism, falling = tension |
| Commodities | **Materials and textures** — gold = warmth/luxury, oil = industrial/heavy |
| Time zones | **Light quality** — dawn colours, harsh noon, golden hour, blue hour, night |
| Weather | **Atmosphere** — rain = reflections, sun = shadows, fog = mystery |

### 1.2 The Sun-Following Metaphor

The exchange rails are ordered **east to west**. This is not arbitrary.

```
┌─────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (East)         CENTRE              RIGHT RAIL (West) │
│  ─────────────────        ──────              ───────────────── │
│  Where sun is RISING      Your creative       Where sun is      │
│  Morning energy           space               SETTING           │
│  Markets waking                               Evening energy    │
│  Dawn colours                                 Dusk colours      │
│                                                                  │
│  🇳🇿 🇦🇺 🇯🇵 🇭🇰 🇸🇬 🇮🇳      [PROMPT BUILDER]      🇬🇧 🇫🇷 🇧🇷 🇺🇸 🇨🇦    │
└─────────────────────────────────────────────────────────────────┘
```

**The user is positioned at the centre of the world's rotation.**

They can literally watch Earth's day scroll past them. The exchanges aren't data — they're windows into places experiencing different moments of the same day.

### 1.3 Subconscious Creative Context

When a user sees:

- **Hong Kong 🌙 23°C • HKEX Closed** — That's not data. That's *a warm night in a sleeping city*.
- **London ☀️ 8°C • LSE Open** — That's *cold morning light, city buzzing with energy*.
- **Gold +1.2%** — That's *warmth, luxury, amber tones, prosperity*.
- **Oil -0.8%** — That's *industrial weight, dark tones, machines slowing*.

The user might not consciously think "I'll use gold tones because gold is up" — but the ambient presence shapes mood. This is **felt, not explained**.

### 1.4 The Tagline

> **"The world is your mood board."**

Or:

> **"Every market open. Every sunset. Every full moon. All of it — fuel."**

---

## Part 2: The AI Providers Leaderboard as Stock Exchange Board

### 2.1 Visual Concept

The AI Providers Leaderboard should **look and feel like a stock exchange trading board**.

```
┌─────────────────────────────────────────────────────────────────┐
│  AI PROVIDERS                                    LIVE RANKINGS  │
│  ═══════════════════════════════════════════════════════════════│
│  #   PROVIDER          SCORE    24H      7D       VOTES   TIER  │
│  ───────────────────────────────────────────────────────────────│
│  1   Midjourney        94.2    +0.3↑    +1.2↑    12.4K    T2   │
│  2   DALL-E 3          91.8    +0.1↑    -0.4↓     9.8K    T3   │
│  3   Stability AI      89.4    -0.2↓    +0.8↑     8.2K    T1   │
│  4   Leonardo          87.1    +0.5↑    +2.1↑     7.1K    T1   │
│  5   Adobe Firefly     85.3    +0.0     +0.3↑     6.4K    T3   │
│  ⋮                                                              │
│  42  Craiyon           34.2    -0.1↓    -1.2↓     0.8K    T4   │
│  ───────────────────────────────────────────────────────────────│
│  📊 Market Hours: Always Open • 🗳️ Votes Today: 2,847           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Stock Exchange Parallels

| Stock Exchange Element | AI Leaderboard Equivalent |
|------------------------|---------------------------|
| Ticker symbol | Provider ID/logo |
| Stock price | Quality score |
| Price change (24h) | Score change (24h) |
| Volume | Vote count |
| Market cap | Total historical engagement |
| Sector | Platform tier (T1-T4) |
| Trading hours | "Always open" (24/7 voting) |
| IPO | New provider added |
| Delisting | Provider deprecated |

### 2.3 Dynamic Elements

The leaderboard should feel **alive**:

- **Score ticks** — Small animations when scores update
- **Colour coding** — Green for rising, red for falling
- **"Hot" indicators** — 🔥 for providers gaining rapidly
- **New entry flash** — Highlight when a provider moves up/down ranks
- **Volatility indicator** — Show which providers have unstable scores

### 2.4 Connection to Prompt Builder

When a user clicks a provider row:

1. They navigate to `/providers/[id]`
2. The prompt builder loads with **that provider's tier-specific limits**
3. The platform optimization applies automatically
4. The leaderboard context (score, rank) could appear subtly in the header

**The leaderboard IS the menu. The prompt builder IS the workspace.**

---

## Part 3: WorldPrompt — The Living Prompt Feature

### 3.1 Concept Overview

WorldPrompt is Promagen's signature feature: **automated, contextual prompts generated from real-world data, rotating around the globe every 30 minutes**.

```
┌─────────────────────────────────────────────────────────────────┐
│  🌍 WORLDPROMPT                                         LIVE    │
│  ═══════════════════════════════════════════════════════════════│
│                                                                  │
│  247 people on Promagen right now                               │
│  ┌─────┬─────┬─────┬─────┬─────┐                                │
│  │ 🇮🇳  │ 🇬🇧  │ 🇺🇸  │ 🇦🇺  │ 🇯🇵  │                                │
│  │ 89  │ 52  │ 41  │ 33  │ 32  │                                │
│  └─────┴─────┴─────┴─────┴─────┘                                │
│                                                                  │
│  🇮🇳 India leads — here's what Mumbai sees right now:            │
│                                                                  │
│  NSE Open • 32°C Humid • ☀️ Late Afternoon • Gold +0.8%          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ "A bustling cotton market at golden hour, Mumbai skyline    │ │
│  │ in humid haze, merchants in white kurta, warm amber light,  │ │
│  │ monsoon clouds gathering on the horizon, prosperity in      │ │
│  │ the air as gold prices rise"                                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  See this prompt optimised for:                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Midjourney│ │ Stability │ │ DALL-E   │ │ Canva    │            │
│  │ (Tier 2) │ │ (Tier 1) │ │ (Tier 3) │ │ (Tier 4) │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│                                                                  │
│  ⏱️ Next WorldPrompt: Hong Kong in 24 minutes                    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Inputs

WorldPrompt combines multiple real-time data sources:

| Data Source | What It Provides | Example Output |
|-------------|------------------|----------------|
| **User presence** | Country with most online users | "India leads" |
| **Exchange status** | Market open/closed, which exchange | "NSE Open" |
| **Weather API** | Temperature, conditions | "32°C Humid" |
| **Time calculation** | Local time of day | "Late Afternoon" |
| **Commodity prices** | Top movers for that region | "Gold +0.8%" |
| **Country profile** | Cultural keywords, landscapes | "cotton market, kurta, monsoon" |
| **Cosmic events** | Moon phase, eclipses | "Full moon rising" |
| **Seasonal context** | Current season, festivals | "Monsoon season" |

### 3.3 The 4-Tier Prompt Display

This is **educational gold**. Users see the same creative concept expressed four different ways:

#### Tier 2 — Midjourney
```
bustling cotton market, golden hour, Mumbai skyline, humid haze, 
merchants in white kurta, warm amber light, monsoon clouds, 
gold prosperity vibes --ar 16:9 --style raw --no modern cars, 
western clothing, cloudy sky
```

#### Tier 1 — Stability/CLIP
```
cotton market, golden hour, Mumbai, humid atmosphere, merchants, 
white traditional clothing, amber lighting, monsoon clouds, 
photorealistic, 8k, highly detailed, cinematic composition
```

#### Tier 3 — DALL-E/Natural Language
```
A photorealistic image of a traditional cotton market in Mumbai 
during late afternoon golden hour. Merchants wearing white kurta 
stand among bales of cotton, with the humid city skyline visible 
through amber haze. Monsoon clouds gather on the horizon, 
creating a sense of anticipation.
```

#### Tier 4 — Canva/Plain
```
Mumbai cotton market at sunset with merchants in white clothes
```

**Users instantly understand why platform choice matters.**

### 3.4 The 30-Minute Rotation

The "featured zone" moves westward with the sun:

```
Hour 0 (UTC Midnight): International Date Line → Pacific
Hour 6 (UTC 06:00): Asia/Australia morning
Hour 12 (UTC Noon): Europe/Africa midday  
Hour 18 (UTC 18:00): Americas afternoon
Hour 24: Back to Date Line

Each 30-minute slot = ~7.5° of longitude
48 slots per day = 48 unique WorldPrompts
```

```typescript
function getCurrentFeaturedZone(): number {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  
  // Each 30-min slot = 7.5° of longitude
  const slot = (utcHour * 2) + (utcMinute >= 30 ? 1 : 0);
  
  // Map slot to longitude (0 = midnight line, moving west)
  const longitude = 180 - (slot * 7.5);
  
  return longitude;
}
```

### 3.5 User Presence Override

When a country has significantly more users online, it **overrides** the rotation:

```typescript
function getFeaturedCountry(
  rotationLongitude: number,
  userPresence: CountryPresence[]
): CountryCreativeProfile {
  
  const topCountry = userPresence[0];
  const secondCountry = userPresence[1];
  
  // If top country has 2x the users of second place, feature them
  if (topCountry.count >= secondCountry.count * 2) {
    return getCountryProfile(topCountry.code);
  }
  
  // Otherwise, follow the sun
  return getCountryByLongitude(rotationLongitude);
}
```

This creates **community moments** — when India has 200 users online and everyone else has 50, the world sees India's prompt. Users feel part of something.

---

## Part 4: Contextual Whispers & Inspire Me

### 4.1 Contextual Whispers (Passive)

A subtle, rotating line above the prompt builder that reflects current world state:

```
☀️ Dawn breaking over Tokyo — try: "golden hour", "soft light", "awakening"
```

```
🌕 Full moon tonight — try: "silver glow", "nocturnal", "mysterious"  
```

```
📈 Markets surging globally — try: "vibrant", "electric", "momentum"
```

```
🌧️ Monsoon hitting Mumbai — try: "rain-slicked", "reflections", "dramatic clouds"
```

**Not pushy. Just whispers from the world.**

### 4.2 "Inspire Me" Button (Active)

Next to the 🎲 Randomise button:

```
[🎲 Randomise]  [🌍 Inspire Me]
```

When clicked:

1. Gathers current world context:
   - Lunar phase
   - Which markets are open/closed
   - Weather in visible exchange cities
   - Market sentiment (overall)
   - Any cosmic events
   
2. Pre-fills intelligent suggestions:

```
┌─────────────────────────────────────────────────────────────────┐
│  🌍 The world right now:                                        │
│                                                                  │
│  Sydney: Thunderstorm ⛈️ • Hong Kong: Sleeping under full moon  │
│  London: Crisp morning ❄️ • Markets: Cautiously optimistic 📈   │
│                                                                  │
│  Suggested fills:                                                │
│  ┌─────────────┬─────────────────────────────────────┐          │
│  │ Lighting    │ Moonlit, Overcast, Dramatic         │          │
│  │ Atmosphere  │ Electric, Contemplative, Tense      │          │
│  │ Colour      │ Silver, Deep blue, Storm grey       │          │
│  └─────────────┴─────────────────────────────────────┘          │
│                                                                  │
│  [Apply suggestions]  [Shuffle]  [Cancel]                       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Ambient UI Tint (Subliminal)

The prompt builder's background **subtly shifts** based on world state:

| Condition | UI Tint |
|-----------|---------|
| Markets broadly up | Warm golden undertone |
| Markets broadly down | Cool blue undertone |
| Full moon | Silver/white highlights |
| Eclipse happening | Deep purple/shadow |
| Most exchanges closed (night) | Darker, more contrast |
| Most exchanges open (day) | Lighter, softer |

**The user doesn't know WHY the interface feels different today. But it does.**

---

## Part 5: Seasonal Events & Special Protocols

### 5.1 Event Calendar

| Event | When | Mechanic |
|-------|------|----------|
| **🎅 Santa Tracker** | Dec 24-25 | Follows Santa east → west, Christmas prompts per timezone |
| **🎆 New Year's Eve** | Dec 31 | Fireworks prompts travel timezone by timezone |
| **🧧 Lunar New Year** | Jan/Feb | Dragon energy travels through Asia |
| **🪔 Diwali** | Oct/Nov | Light spreads across India, then diaspora cities |
| **🌙 Ramadan** | Variable | Iftar prompts follow sunset around the world |
| **🌸 Cherry Blossom** | Mar-May | Follows bloom from Japan → Korea → Washington DC |
| **⚽ FIFA World Cup** | Tournament dates | Match-specific prompts, nation cards |
| **🏏 T20 World Cup** | Tournament dates | Cricket nations featured |
| **🌑 Solar Eclipse** | When they occur | Prompts follow path of totality |
| **🌕 Lunar Eclipse** | When they occur | Blood moon themes globally |
| **☀️ Solstice** | Jun 21 / Dec 21 | Longest light or deepest dark |
| **🌗 Equinox** | Mar 20 / Sep 22 | Balance, transition, duality |

### 5.2 The Santa Protocol (Christmas Eve)

December 24th, Promagen tracks Santa delivering presents:

```
┌─────────────────────────────────────────────────────────────────┐
│  🎅 SANTA TRACKER × PROMAGEN                           LIVE     │
│  ═══════════════════════════════════════════════════════════════│
│                                                                  │
│  Santa is currently over: 🇳🇿 New Zealand                        │
│  Local time: 11:47 PM • 🌙 Clear skies • 18°C                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ "Reindeer silhouettes over Auckland Sky Tower, moonlit      │ │
│  │ harbour, children sleeping in wooden houses, summer         │ │
│  │ Christmas, pohutukawa flowers glowing red, magical dust     │ │
│  │ trailing through southern stars"                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  🎁 Santa arrives next: 🇦🇺 Sydney in 43 minutes                 │
│                                                                  │
│  [Generate your own Christmas prompt for New Zealand]           │
│                                                                  │
│  Previous stops: 🇫🇯 Fiji • 🇹🇴 Tonga • 🇼🇸 Samoa                  │
│  Coming up: 🇦🇺 🇯🇵 🇰🇷 🇭🇰 🇸🇬 🇮🇳 🇦🇪 🇪🇺 🇬🇧 🇧🇷 🇺🇸 🇨🇦             │
└─────────────────────────────────────────────────────────────────┘
```

**Every timezone gets a unique, culturally-specific Christmas prompt.**

- 🇳🇿 New Zealand: Summer Christmas, pohutukawa, beach barbecue
- 🇯🇵 Japan: KFC Christmas, illuminations, strawberry cake
- 🇩🇪 Germany: Snow, Christmas markets, Glühwein, nutcrackers
- 🇧🇷 Brazil: Summer heat, Papai Noel, tropical decorations
- 🇺🇸 USA: Snow (north), fireplace, cookies for Santa, red and green

### 5.3 World Cup Mode

During FIFA World Cup or T20 Cricket World Cup:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚽ WORLD CUP MODE                                      ACTIVE   │
│  ═══════════════════════════════════════════════════════════════│
│                                                                  │
│  Today's Match: 🇧🇷 Brazil vs 🇩🇪 Germany • Kickoff 20:00 UTC   │
│                                                                  │
│  🇧🇷 Brazil WorldPrompt:                                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ "Maracanã stadium erupting in yellow and green, samba       │ │
│  │ drums echoing, tropical night air thick with anticipation,  │ │
│  │ Christ the Redeemer watching over Rio, coffee and passion"  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  🇩🇪 Germany WorldPrompt:                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ "Berlin fan zone in winter evening, breath visible in       │ │
│  │ floodlights, black red gold flags waving, precision and     │ │
│  │ determination, beer steins raised, industrial strength"     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  [Generate prompt for Brazil] [Generate prompt for Germany]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Country Info Cards

### 6.1 Exchange Nations

Standard exchange card with creative metadata:

```
┌─────────────────────────────────────────────────────────────────┐
│  🇮🇳 INDIA                                              NSE/BSE │
│  ───────────────────────────────────────────────────────────────│
│  🕐 15:42 Local  •  ☀️ 32°C Humid  •  Mumbai                     │
│  📈 NSE: +1.2%  •  Gold: +0.8%  •  Cotton: -0.3%                │
│                                                                  │
│  Key Commodities: Cotton • Tea • Spices • Gold • Rice           │
│  Landscapes: Himalayas • Ganges • Thar Desert • Kerala backwaters│
│  Urban: Mumbai skyline • Bazaars • Auto-rickshaws • Temples     │
│  Cultural: Saris • Bollywood • Chai wallahs • Holi colours      │
│  Season: Monsoon approaching                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Non-Exchange Nations (World Cup Mode)

For countries without major exchanges (e.g., Senegal, Jamaica):

```
┌─────────────────────────────────────────────────────────────────┐
│  🇸🇳 SENEGAL                                            ⚽ WC    │
│  ───────────────────────────────────────────────────────────────│
│  🕐 14:32 Local  •  ☀️ 31°C Hot  •  Dakar                        │
│                                                                  │
│  Key Exports: Groundnuts • Fish • Phosphates • Cotton           │
│  Landscapes: Sahel • Baobab trees • Pink Lake • Atlantic coast  │
│  Urban: Dakar markets • Fishing boats • Colourful buses         │
│  Cultural: Teranga hospitality • Mbalax music • Wrestling       │
│  Colours: Green, Yellow, Red • Lion of Senegal                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ WorldPrompt:                                                │ │
│  │ "Senegalese wrestlers at sunset, baobab shadows on red      │ │
│  │ earth, Atlantic waves in distance, golden groundnut         │ │
│  │ harvest, vibrant green and yellow fabrics, lion spirit"     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Card Replaces Exchange During Events

During World Cup, country cards can **temporarily replace** exchange cards in the rails:

- If Brazil is playing, Brazil card appears in West rail
- If India is playing (cricket), India's NSE card gets enhanced with cricket context
- Non-exchange nations get full cards during their matches

---

## Part 7: Country Creative Profiles Data Schema

### 7.1 Complete Schema

```typescript
interface CountryCreativeProfile {
  // === IDENTITY ===
  countryCode: string;              // ISO 3166-1 alpha-2 (e.g., "IN")
  countryName: string;              // "India"
  flag: string;                     // "🇮🇳"
  region: string;                   // "South Asia"
  
  // === GEOGRAPHY ===
  capital: string;                  // "New Delhi"
  majorCities: string[];            // ["Mumbai", "Delhi", "Bangalore", "Chennai"]
  longitude: number;                // Primary longitude for rotation calc
  timezone: string;                 // "Asia/Kolkata"
  
  // === EXCHANGE (optional) ===
  exchange?: {
    code: string;                   // "NSE"
    name: string;                   // "National Stock Exchange"
    city: string;                   // "Mumbai"
    mic: string;                    // Market Identifier Code
  };
  
  // === CREATIVE FUEL ===
  commodities: {
    primary: string[];              // ["Cotton", "Tea", "Spices"]
    secondary: string[];            // ["Rice", "Wheat", "Sugar"]
    minerals: string[];             // ["Iron ore", "Coal"]
  };
  
  landscapes: {
    natural: string[];              // ["Himalayas", "Ganges", "Thar Desert"]
    rural: string[];                // ["Rice paddies", "Tea plantations", "Villages"]
    coastal: string[];              // ["Kerala backwaters", "Goa beaches"]
  };
  
  urbanScenes: {
    landmarks: string[];            // ["Taj Mahal", "Gateway of India"]
    streetLife: string[];           // ["Bazaars", "Auto-rickshaws", "Chai stalls"]
    modern: string[];               // ["Mumbai skyline", "Tech parks", "Metro"]
  };
  
  cultural: {
    clothing: string[];             // ["Saris", "Kurta", "Turbans"]
    food: string[];                 // ["Curry", "Chai", "Street food"]
    music: string[];                // ["Bollywood", "Classical ragas", "Bhangra"]
    art: string[];                  // ["Rangoli", "Mehndi", "Temple carvings"]
    traditions: string[];           // ["Namaste", "Diwali", "Holi"]
  };
  
  colours: {
    national: string[];             // ["Saffron", "White", "Green"]
    cultural: string[];             // ["Gold", "Red", "Magenta", "Turquoise"]
  };
  
  symbols: {
    animals: string[];              // ["Tiger", "Elephant", "Peacock"]
    plants: string[];               // ["Lotus", "Banyan", "Mango"]
    icons: string[];                // ["Om", "Chakra", "Namaste hands"]
  };
  
  // === SEASONAL ===
  seasons: {
    summer: SeasonProfile;
    monsoon?: SeasonProfile;        // India, SE Asia
    winter: SeasonProfile;
    autumn?: SeasonProfile;
    spring?: SeasonProfile;
    dry?: SeasonProfile;            // Africa, Australia
    wet?: SeasonProfile;            // Tropics
  };
  
  // === FESTIVALS ===
  festivals: {
    name: string;
    months: number[];               // [10, 11] for Oct-Nov
    keywords: string[];
    colours: string[];
  }[];
  
  // === SPORTS ===
  sports: {
    football: boolean;
    cricket: boolean;
    rugby: boolean;
    other: string[];                // ["Hockey", "Kabaddi"]
  };
  
  // === PROMPT TEMPLATES ===
  promptTemplates: {
    dawn: string;
    morning: string;
    afternoon: string;
    evening: string;
    night: string;
    festival?: Record<string, string>;
  };
}

interface SeasonProfile {
  months: number[];                 // [6, 7, 8] for Jun-Aug
  weather: string[];                // ["Hot", "Humid", "Rainy"]
  keywords: string[];               // ["Monsoon clouds", "Wet streets", "Umbrellas"]
  colours: string[];                // ["Grey", "Green", "Earth tones"]
}
```

### 7.2 Example: Complete India Profile

```json
{
  "countryCode": "IN",
  "countryName": "India",
  "flag": "🇮🇳",
  "region": "South Asia",
  "capital": "New Delhi",
  "majorCities": ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad"],
  "longitude": 78.9629,
  "timezone": "Asia/Kolkata",
  
  "exchange": {
    "code": "NSE",
    "name": "National Stock Exchange",
    "city": "Mumbai",
    "mic": "XNSE"
  },
  
  "commodities": {
    "primary": ["Cotton", "Tea", "Spices", "Gold"],
    "secondary": ["Rice", "Wheat", "Sugar", "Jute"],
    "minerals": ["Iron ore", "Coal", "Diamonds"]
  },
  
  "landscapes": {
    "natural": ["Himalayas", "Ganges river", "Thar Desert", "Western Ghats", "Sundarbans"],
    "rural": ["Rice paddies", "Tea plantations", "Mango orchards", "Village wells"],
    "coastal": ["Kerala backwaters", "Goa beaches", "Marina Beach", "Fishing villages"]
  },
  
  "urbanScenes": {
    "landmarks": ["Taj Mahal", "Gateway of India", "Red Fort", "Lotus Temple"],
    "streetLife": ["Bazaars", "Auto-rickshaws", "Chai wallahs", "Flower markets", "Spice stalls"],
    "modern": ["Mumbai skyline", "Bangalore tech parks", "Delhi Metro", "Glass towers"]
  },
  
  "cultural": {
    "clothing": ["Saris", "Kurta pajama", "Turbans", "Bindis", "Gold jewellery"],
    "food": ["Curry", "Chai", "Samosas", "Biryani", "Street food carts", "Thali"],
    "music": ["Bollywood", "Classical sitar", "Tabla drums", "Bhangra"],
    "art": ["Rangoli", "Mehndi", "Temple carvings", "Miniature paintings"],
    "traditions": ["Namaste greeting", "Removing shoes", "Head wobble", "Joint families"]
  },
  
  "colours": {
    "national": ["Saffron", "White", "Green"],
    "cultural": ["Gold", "Red", "Magenta", "Turquoise", "Orange", "Hot pink"]
  },
  
  "symbols": {
    "animals": ["Bengal tiger", "Elephant", "Peacock", "Cobra", "Cow"],
    "plants": ["Lotus", "Banyan tree", "Mango", "Jasmine", "Marigold"],
    "icons": ["Om symbol", "Chakra wheel", "Namaste hands", "Diya lamp"]
  },
  
  "seasons": {
    "summer": {
      "months": [3, 4, 5],
      "weather": ["Hot", "Dry", "Dusty"],
      "keywords": ["Scorching sun", "Dust devils", "Mango season", "Seeking shade"],
      "colours": ["Burnt orange", "Dusty yellow", "Bleached white"]
    },
    "monsoon": {
      "months": [6, 7, 8, 9],
      "weather": ["Rainy", "Humid", "Storms"],
      "keywords": ["Monsoon clouds", "Wet streets", "Umbrellas", "Chai in rain", "Green explosion"],
      "colours": ["Grey", "Lush green", "Earth brown", "Petrichor"]
    },
    "winter": {
      "months": [11, 12, 1, 2],
      "weather": ["Cool", "Foggy", "Pleasant"],
      "keywords": ["Morning fog", "Bonfire warmth", "Sweater weather", "Clear skies"],
      "colours": ["Soft gold", "Warm amber", "Misty white"]
    }
  },
  
  "festivals": [
    {
      "name": "Diwali",
      "months": [10, 11],
      "keywords": ["Diya lamps", "Fireworks", "Rangoli", "Sweets", "New clothes", "Light over darkness"],
      "colours": ["Gold", "Orange", "Red", "Sparkle"]
    },
    {
      "name": "Holi",
      "months": [3],
      "keywords": ["Colour powder", "Water balloons", "Joy", "Dance", "Forgiveness"],
      "colours": ["Every colour", "Pink", "Purple", "Yellow", "Blue"]
    },
    {
      "name": "Ganesh Chaturthi",
      "months": [8, 9],
      "keywords": ["Ganesh idol", "Procession", "Immersion", "Modak sweets"],
      "colours": ["Red", "Gold", "Orange"]
    }
  ],
  
  "sports": {
    "football": true,
    "cricket": true,
    "rugby": false,
    "other": ["Hockey", "Kabaddi", "Badminton"]
  },
  
  "promptTemplates": {
    "dawn": "First light over {city}, chai steam rising, {season_keyword}, temple bells in distance",
    "morning": "Bustling {urban_scene} in morning rush, {commodity} merchants, golden light through haze",
    "afternoon": "Hot afternoon in {landscape}, {cultural_clothing}, seeking shade under {plant}",
    "evening": "Golden hour at {landmark}, {cultural_tradition}, warm amber light, {season_colour} sky",
    "night": "Night market in {city}, neon and diya lamps, {food} stalls, {cultural_music} playing"
  }
}
```

---

## Part 8: Prompt Generation Engine

### 8.1 Assembly Logic

```typescript
interface WorldPromptContext {
  country: CountryCreativeProfile;
  exchange?: ExchangeStatus;
  weather: WeatherData;
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
  season: string;
  commodities: CommodityMovement[];
  cosmicEvent?: CosmicEvent;
  activeEvent?: SpecialEvent;  // World Cup, Christmas, etc.
  userPresence: number;        // Users from this country online
}

function generateWorldPrompt(ctx: WorldPromptContext): string {
  const parts: string[] = [];
  
  // 1. Scene anchor (urban or landscape based on time)
  if (ctx.timeOfDay === 'night' || ctx.timeOfDay === 'evening') {
    parts.push(pickRandom(ctx.country.urbanScenes.streetLife));
  } else {
    parts.push(pickRandom(ctx.country.landscapes.natural));
  }
  
  // 2. Time-specific lighting
  parts.push(getTimeOfDayLighting(ctx.timeOfDay));
  
  // 3. Weather influence
  if (ctx.weather.condition !== 'clear') {
    parts.push(getWeatherKeyword(ctx.weather));
  }
  
  // 4. Cultural elements
  parts.push(pickRandom(ctx.country.cultural.clothing));
  parts.push(pickRandom(ctx.country.cultural.traditions));
  
  // 5. Commodity influence (if significant movement)
  const topMover = ctx.commodities.find(c => Math.abs(c.change) > 0.5);
  if (topMover) {
    parts.push(getCommodityMood(topMover));
  }
  
  // 6. Season-specific
  const seasonProfile = ctx.country.seasons[ctx.season];
  if (seasonProfile) {
    parts.push(pickRandom(seasonProfile.keywords));
  }
  
  // 7. Cosmic overlay
  if (ctx.cosmicEvent) {
    parts.push(getCosmicKeywords(ctx.cosmicEvent));
  }
  
  // 8. Special event overlay
  if (ctx.activeEvent) {
    parts.push(getEventKeywords(ctx.activeEvent, ctx.country));
  }
  
  return assembleNaturalPrompt(parts);
}
```

### 8.2 Tier Optimization

```typescript
function optimizeForTier(
  basePrompt: string, 
  tier: 1 | 2 | 3 | 4,
  negatives: string[]
): string {
  switch (tier) {
    case 2: // Midjourney
      return `${basePrompt} --ar 16:9 --style raw --no ${negatives.join(', ')}`;
      
    case 1: // CLIP/Stability
      const clipKeywords = extractKeywords(basePrompt);
      return `${clipKeywords.join(', ')}, photorealistic, 8k, highly detailed`;
      
    case 3: // Natural Language (DALL-E)
      return `A photorealistic image of ${convertToNaturalLanguage(basePrompt)}`;
      
    case 4: // Plain (Canva)
      return simplifyToCore(basePrompt, 10); // Max 10 words
      
    default:
      return basePrompt;
  }
}
```

---

## Part 9: Technical Implementation Requirements

### 9.1 Data Sources Needed

| Data | Source | Refresh Rate | Priority |
|------|--------|--------------|----------|
| User presence by country | Vercel Analytics / PostHog / Custom WebSocket | Real-time | P0 |
| Exchange status | Existing exchange data | 1 min | P0 |
| Weather | OpenWeather or Twelve Data | 15 min cache | P0 |
| Commodity prices | Twelve Data | 1 min | P1 |
| Cosmic events | Astronomy API or pre-calculated | Daily | P1 |
| Country profiles | Static JSON (your dataset) | Deploy-time | P0 |
| Festival calendar | Static JSON | Deploy-time | P1 |
| Santa tracker | NORAD API (Dec 24) | 1 min | P2 |

### 9.2 New Files Needed

```
frontend/src/
├── data/
│   ├── country-profiles.json        # All 200 countries
│   ├── cosmic-events.json           # 2026 lunar/solar events
│   └── festival-calendar.json       # Major world festivals
├── hooks/
│   ├── use-world-prompt.ts          # Main WorldPrompt logic
│   ├── use-user-presence.ts         # Real-time user counts
│   └── use-cosmic-events.ts         # Current cosmic state
├── components/
│   ├── world-prompt/
│   │   ├── WorldPromptDisplay.tsx   # Main component
│   │   ├── CountryPresenceBar.tsx   # Flag + count bar
│   │   ├── TierPromptTabs.tsx       # 4-tier display
│   │   └── ContextWhisper.tsx       # Subtle suggestion line
│   ├── country-card/
│   │   ├── ExchangeCountryCard.tsx  # Standard exchange card
│   │   └── EventCountryCard.tsx     # World Cup nation card
│   └── events/
│       ├── SantaTracker.tsx         # Christmas special
│       └── WorldCupMode.tsx         # Football/Cricket mode
├── lib/
│   ├── prompt-generator.ts          # Assembly logic
│   ├── tier-optimizer.ts            # 4-tier conversion
│   └── rotation-calculator.ts       # 30-min zone logic
└── api/
    ├── world-prompt/
    │   └── route.ts                 # Generate current WorldPrompt
    └── user-presence/
        └── route.ts                 # WebSocket or polling endpoint
```

### 9.3 API Endpoints

```
GET /api/world-prompt
Returns: Current WorldPrompt with all 4 tier versions

GET /api/world-prompt/next
Returns: Preview of next 3 upcoming WorldPrompts

GET /api/user-presence
Returns: Online users by country (top 10)

WS /api/presence-stream
WebSocket: Real-time presence updates

GET /api/cosmic
Returns: Current lunar phase, upcoming events

GET /api/events/active
Returns: Any active special events (World Cup, etc.)
```

---

## Part 10: Success Metrics

### 10.1 The 10-Second Test

**Pass criteria:** A new user understands what Promagen does within 10 seconds of landing.

**How WorldPrompt achieves this:**
- They see a live prompt being generated
- They see it references real-world data (weather, markets, time)
- They see it adapts to different AI platforms
- They feel "this is alive, not static"

### 10.2 Engagement Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Time on homepage | >45 seconds | They're watching WorldPrompt change |
| Return visits within 7 days | >30% | "I wonder what's generating now" |
| WorldPrompt → Prompt Builder | >15% | They want to build on what they saw |
| Social shares | Track | "Look what Promagen made for India" |
| Geographic diversity | Track | Building global community |

### 10.3 Community Metrics

| Metric | Target |
|--------|--------|
| Countries with 10+ users | 50+ |
| Peak concurrent users | Track growth |
| "My country featured" moments | Track happiness |

---

## Part 11: Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create `country-profiles.json` with 50 countries (all exchanges + top World Cup nations)
- [ ] Build `WorldPromptDisplay` component
- [ ] Implement 30-minute rotation logic
- [ ] Build tier optimizer for all 4 tiers
- [ ] Add contextual whispers above prompt builder

### Phase 2: Presence (Week 3)
- [ ] Implement user presence tracking
- [ ] Build `CountryPresenceBar` component
- [ ] Add presence-override logic (dominant country wins)
- [ ] Real-time updates via polling (WebSocket later)

### Phase 3: Polish (Week 4)
- [ ] Complete country profiles to 100+ countries
- [ ] Add cosmic events integration
- [ ] Build `InspireMe` button with suggestions
- [ ] Ambient UI tint based on world state

### Phase 4: Events (Ongoing)
- [ ] Santa Tracker for Christmas 2026
- [ ] World Cup mode (when tournaments scheduled)
- [ ] Festival overlays (Diwali, Lunar New Year, etc.)

---

## Part 12: Design Principles

### 12.1 Core Principles

1. **Felt, not explained** — The world influence should be sensed, not read about
2. **Alive, not static** — Something should always be changing
3. **Global, not western** — Every country matters equally
4. **Educational, not gatekept** — Show how prompts work across platforms
5. **Community, not isolation** — Users are part of something bigger

### 12.2 What WorldPrompt Is NOT

- ❌ A gimmick bolted onto a prompt builder
- ❌ Decoration
- ❌ Complicated to understand
- ❌ US/Europe-centric
- ❌ Static content that could be pre-written

### 12.3 What WorldPrompt IS

- ✅ The soul of Promagen
- ✅ Proof that creativity is connected to the world
- ✅ A living demonstration of platform differences
- ✅ A reason to come back
- ✅ Something no one else has

---

## Part 13: WorldPrompt Live Background — Visual Implementation

### 13.1 Concept

WorldPrompt Live Background is the **visual payoff** of the entire WorldPrompt system. Instead of just generating text prompts, Promagen now shows the image.

The homepage background becomes a living canvas — an AI-generated scene derived from the current WorldPrompt context. As the rotation moves around the globe, the background transforms: Sydney at dawn, Tokyo at dusk, London in morning rain, São Paulo in afternoon sunshine.

**This is what makes Promagen truly alive.**

### 13.2 Tier Gating

| Tier | Background | Context Bar | Fullscreen |
|------|------------|-------------|------------|
| Standard Promagen | Static dark gradient | Hidden | N/A |
| Pro Promagen | AI-generated scene | Visible | Available |

Standard users see the existing dark UI. Pro users see the world.

### 13.3 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORLDPROMPT LIVE BACKGROUND                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Existing Data Sources (no new APIs)                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Weather   │ │  Exchange   │ │  FX Ribbon  │ │   Country   │           │
│  │   Badges    │ │   Status    │ │   Movement  │ │   Profile   │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │               │                   │
│         └───────────────┴───────────────┴───────────────┘                   │
│                                   │                                         │
│                                   ▼                                         │
│                    ┌─────────────────────────────┐                          │
│                    │    WorldPromptContext       │                          │
│                    │    (existing from Part 8)   │                          │
│                    └──────────────┬──────────────┘                          │
│                                   │                                         │
│                                   ▼                                         │
│                    ┌─────────────────────────────┐                          │
│                    │    generateWorldPrompt()    │                          │
│                    │    → text prompt            │                          │
│                    └──────────────┬──────────────┘                          │
│                                   │                                         │
│                                   ▼                                         │
│                    ┌─────────────────────────────┐                          │
│                    │    /api/worldprompt/image   │                          │
│                    │    → Check cache            │                          │
│                    │    → Generate if miss       │                          │
│                    │    → Return URL             │                          │
│                    └──────────────┬──────────────┘                          │
│                                   │                                         │
│                                   ▼                                         │
│                    ┌─────────────────────────────┐                          │
│                    │    WorldPromptBackground    │                          │
│                    │    → Display image          │                          │
│                    │    → Handle transitions     │                          │
│                    └─────────────────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.4 Image Generation Triggers

The system doesn't regenerate images constantly. It responds to **meaningful changes**:

| Trigger | When | Why |
|---------|------|-----|
| **City rotation** | Every 30 minutes | Core WorldPrompt cycle |
| **Time-of-day shift** | Dawn, morning, afternoon, evening, night | Light quality changes dramatically |
| **Market open/close** | ±1 minute window | Energy state changes (aligns with Market Pulse) |
| **Weather condition change** | Sunny → Rain, etc. | Atmosphere shift |
| **Significant FX move** | >1% change in lead pair | Mood indicator |

**Example day for Sydney:**
- 05:30 AEDT → Dawn image (warm amber, first light)
- 09:00 AEDT → Morning image (bright, ASX about to open)
- 10:00 AEDT → Market open flash (energy spike)
- 13:00 AEDT → Afternoon image (harsh noon, full sun)
- 16:00 AEDT → Market close flash
- 17:30 AEDT → Evening image (golden hour)
- 20:00 AEDT → Night image (city lights)

That's 7 potential images per day for one city. With caching, the same prompt = same cached image.

### 13.5 Prompt-to-Image Mapping

The existing `generateWorldPrompt()` function produces text. That text becomes the image prompt.

**Example context:**
- City: Sydney
- Time: 06:15 local (dawn)
- Weather: 24°C, partly cloudy
- Market: ASX pre-open
- FX: AUD/USD +0.3%
- Season: Summer

**Generated text prompt:**
```
Sydney Harbour at dawn, warm amber light breaking through scattered clouds,
Opera House silhouette against pink-gold sky, sailboats on calm water,
early morning energy before the markets open, summer warmth in the air,
optimistic atmosphere as currencies rise, photorealistic
```

**Image API call:**
```typescript
const response = await openai.images.generate({
  model: "dall-e-3",
  prompt: generatedPrompt,
  size: "1792x1024",
  quality: "standard",
  n: 1
});
```

### 13.6 Visual Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VIEWPORT                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  z-index: -2                                                          │  │
│  │  BACKGROUND IMAGE                                                     │  │
│  │  position: fixed; inset: 0; object-fit: cover;                       │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │  z-index: -1                                                    │ │  │
│  │  │  DARK OVERLAY                                                   │ │  │
│  │  │  position: fixed; inset: 0; background: rgba(0,0,0,0.7);       │ │  │
│  │  │                                                                 │ │  │
│  │  │  ┌───────────────────────────────────────────────────────────┐ │ │  │
│  │  │  │  z-index: 0+                                              │ │ │  │
│  │  │  │  EXISTING UI                                              │ │ │  │
│  │  │  │  FX Ribbon, Exchange Cards, Providers Table, etc.        │ │ │  │
│  │  │  │                                                           │ │ │  │
│  │  │  └───────────────────────────────────────────────────────────┘ │ │  │
│  │  │                                                                 │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  z-index: 10                                                          │  │
│  │  CONTEXT BAR                                                          │  │
│  │  position: fixed; bottom: 0;                                          │  │
│  │  ● Sydney, Australia • ASX Open • 24°C ☀️ • AUD/USD +0.3%  [Expand]  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.7 Image Transitions

When a new image arrives:

```typescript
// Transition sequence
1. newImage.onload = () => {
2.   newImage.classList.add('worldprompt-bg--entering');
3.   await nextFrame();
4.   oldImage.classList.add('worldprompt-bg--exiting');
5.   newImage.classList.remove('worldprompt-bg--entering');
6.   newImage.classList.add('worldprompt-bg--active');
7.   await sleep(2000); // Crossfade duration
8.   oldImage.remove();
9. }
```

CSS:
```css
.worldprompt-bg {
  transition: opacity 2s ease-in-out;
}

.worldprompt-bg--entering {
  opacity: 0;
}

.worldprompt-bg--active {
  opacity: 1;
}

.worldprompt-bg--exiting {
  opacity: 0;
}

/* Reduced motion: instant swap */
@media (prefers-reduced-motion: reduce) {
  .worldprompt-bg {
    transition: none;
  }
}
```

### 13.8 Context Bar Design

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● Sydney, Australia • ASX Open • 24°C ☀️ • AUD/USD +0.3%        [Expand ⛶] │
└──────────────────────────────────────────────────────────────────────────────┘
  │ │                   │        │       │                              │
  │ │                   │        │       │                              └─ Expand
  │ │                   │        │       └─ Lead FX pair + movement         button
  │ │                   │        └─ Weather (temp + emoji)
  │ │                   └─ Market status
  │ └─ City + Country
  └─ Pulsing dot (live indicator)
```

Styling:
- Background: `rgba(0,0,0,0.6)` with `backdrop-filter: blur(8px)`
- Text: White, `text-sm`
- Height: 40px
- Border-top: `1px solid rgba(255,255,255,0.1)`

### 13.9 Fullscreen Mode

When user clicks **[Expand ⛶]**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
│                                                                             │
│           [FULL RESOLUTION IMAGE — NO OVERLAY]                              │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Sydney, Australia • 06:15 AEDT • 24°C Partly Cloudy               │   │
│  │                                                                     │   │
│  │ "Sydney Harbour at dawn, warm amber light breaking through         │   │
│  │ scattered clouds, Opera House silhouette against pink-gold sky..." │   │
│  │                                                       [Copy Prompt] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                     [✕]    │
└─────────────────────────────────────────────────────────────────────────────┘
```

Features:
- Full-bleed image, no dark overlay
- Semi-transparent info panel in bottom-left
- Generated prompt visible (educational + copyable)
- Copy Prompt button for users who want to recreate
- Close button (✕) + ESC key + click outside

**Screensaver potential:** This fullscreen mode is the "screensaver" feature. Users can leave it open as an ambient display.

### 13.10 Cost Control

| Measure | Implementation |
|---------|----------------|
| **Caching** | Hash(prompt) → Vercel KV key → 24h TTL |
| **Deduplication** | Same prompt = cached image, no regeneration |
| **Rate limiting** | Max 1 generation per city per trigger event |
| **Resolution** | 1792×1024 (large enough for most screens, not excessive) |
| **Model** | DALL-E 3 standard quality (~$0.04/image) |

**Daily cost estimate:**
- 12 active cities × 4 time-of-day shifts = 48 potential images
- With caching (same weather, same FX mood) = ~30 unique images
- 30 × $0.04 = **~$1.20/day**

**Monthly estimate:** ~$36/month for the entire platform (not per-user).

### 13.11 Fallback Hierarchy

| Condition | Behaviour |
|-----------|-----------|
| Image loading | Subtle shimmer animation on dark background |
| Image generation failed | Keep previous image, log error, retry in 5 mins |
| Cache miss + API error | Fall back to static gradient |
| API quota exceeded | Disable feature for remainder of day |
| User is Standard Promagen | No image, no context bar |

### 13.12 Implementation Files

```
src/
├── components/worldprompt-live/
│   ├── index.ts                       # Barrel export
│   ├── worldprompt-background.tsx     # Fixed background layer
│   ├── worldprompt-overlay.tsx        # Dark overlay for readability
│   ├── worldprompt-context-bar.tsx    # Bottom info strip
│   ├── worldprompt-fullscreen.tsx     # Modal for expanded view
│   └── worldprompt-shimmer.tsx        # Loading state
├── hooks/
│   └── use-worldprompt-image.ts       # Fetch + cache management
└── app/api/worldprompt/
    └── image/
        └── route.ts                   # Image generation endpoint
```

### 13.13 API Endpoint

```typescript
// src/app/api/worldprompt/image/route.ts

import { kv } from '@vercel/kv';
import OpenAI from 'openai';
import { generateWorldPrompt, getCurrentWorldPromptContext } from '@/lib/worldprompt';
import { createHash } from 'crypto';

const openai = new OpenAI();

export async function GET(request: Request) {
  // 1. Get current WorldPrompt context
  const context = await getCurrentWorldPromptContext();
  
  // 2. Generate prompt text
  const promptText = generateWorldPrompt(context);
  
  // 3. Create cache key from prompt hash
  const hash = createHash('sha256').update(promptText).digest('hex').slice(0, 16);
  const cacheKey = `worldprompt:image:${hash}`;
  
  // 4. Check cache
  const cached = await kv.get<string>(cacheKey);
  if (cached) {
    return Response.json({ 
      imageUrl: cached, 
      cached: true,
      context: {
        city: context.country.name,
        timeOfDay: context.timeOfDay,
        weather: context.weather.condition,
        prompt: promptText
      }
    });
  }
  
  // 5. Generate image
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: promptText,
    size: "1792x1024",
    quality: "standard",
    n: 1
  });
  
  const imageUrl = response.data[0].url;
  
  // 6. Cache for 24 hours
  await kv.set(cacheKey, imageUrl, { ex: 86400 });
  
  // 7. Return
  return Response.json({ 
    imageUrl, 
    cached: false,
    context: {
      city: context.country.name,
      timeOfDay: context.timeOfDay,
      weather: context.weather.condition,
      prompt: promptText
    }
  });
}
```

### 13.14 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pro user engagement | +20% time on homepage | Analytics comparison |
| "Wow" factor | Qualitative | User feedback, social shares |
| Performance | <100ms context bar render | Core Web Vitals |
| Reliability | 99% image availability | Error rate monitoring |
| Cost efficiency | <$50/month | API billing |

---

## Appendix A: Country Profile Dataset Request

To build the complete `country-profiles.json`, the following countries need profiles:

### Priority 1: All Exchange Nations (60+)
USA, UK, Japan, China, Hong Kong, India, Australia, Germany, France, Brazil, Canada, Singapore, South Korea, South Africa, Mexico, Russia, Saudi Arabia, UAE, Indonesia, Thailand, Malaysia, Philippines, Vietnam, Poland, Turkey, Nigeria, Egypt, Israel, Switzerland, Netherlands, Norway, Sweden, Spain, Italy, Belgium, Austria, Ireland, Denmark, Finland, New Zealand, Taiwan, Pakistan, Bangladesh, Sri Lanka, Kenya, Morocco, Chile, Argentina, Colombia, Peru...

### Priority 2: World Cup Nations Without Exchanges (30+)
Senegal, Ghana, Cameroon, Tunisia, Costa Rica, Jamaica, Panama, Uruguay, Ecuador, Serbia, Croatia, Wales, Iran, Qatar, Iceland, Panama, Honduras, Algeria, Ivory Coast, DR Congo...

### Priority 3: Remaining Nations (100+)
All other countries for comprehensive global coverage.

**Deliverable:** Complete JSON file with all countries following the schema in Part 7.

---

## Appendix B: Cosmic Events Calendar 2026

| Event | Date | Type | Visibility |
|-------|------|------|------------|
| Full Moon | Jan 13 | Lunar | Global |
| New Moon | Jan 29 | Lunar | Global |
| Full Moon | Feb 12 | Lunar | Global |
| Total Lunar Eclipse | Mar 14 | Eclipse | Americas, Europe, Africa |
| Full Moon | Mar 14 | Lunar | Global |
| Spring Equinox | Mar 20 | Equinox | Global |
| Partial Solar Eclipse | Mar 29 | Eclipse | Europe, N Africa, W Asia |
| Full Moon | Apr 12 | Lunar | Global |
| Full Moon | May 12 | Lunar | Global |
| Full Moon | Jun 11 | Lunar | Global |
| Summer Solstice | Jun 21 | Solstice | Global |
| Full Moon | Jul 10 | Lunar | Global |
| Full Moon | Aug 8 | Lunar | Global |
| Partial Lunar Eclipse | Sep 7 | Eclipse | Europe, Africa, Asia, Australia |
| Full Moon | Sep 7 | Lunar | Global |
| Autumn Equinox | Sep 22 | Equinox | Global |
| Full Moon | Oct 6 | Lunar | Global |
| Full Moon | Nov 5 | Lunar | Global |
| Full Moon | Dec 4 | Lunar | Global |
| Winter Solstice | Dec 21 | Solstice | Global |

---

## Changelog

- **9 Jan 2026:** **WORLDPROMPT LIVE BACKGROUND** — Added Part 13: WorldPrompt Live Background — Visual Implementation. Pro Promagen exclusive feature. Homepage background becomes AI-generated scene from WorldPrompt data. Includes: visual layer architecture, image generation triggers, context bar design, fullscreen mode, cost control (~$1.20/day), API endpoint specification, component structure. Authority for tier gating: `paid_tier.md` §5.11.
- **5 Jan 2026:** Initial document created. Captures complete WorldPrompt vision including philosophy, AI leaderboard as stock board, WorldPrompt feature, contextual whispers, Inspire Me, seasonal events, Santa Protocol, World Cup mode, country profiles schema, prompt generation engine, and implementation roadmap.

---

## Final Word

> **"The world is your mood board."**

Promagen doesn't just help you write prompts. It connects your creativity to the living, breathing planet — every market open, every sunset, every full moon, every goal scored, every commodity traded.

This is the feature that makes Promagen *Promagen*.

Build it. Ship it. Watch the world create.
