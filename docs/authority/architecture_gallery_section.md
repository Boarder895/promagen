
## Gallery Mode Architecture (NEW v2.1.0)

Gallery Mode introduces a new system layer that generates AI images from market data.

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GALLERY MODE SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   ROTATION   │    │    THEME     │    │   PROMPT     │                  │
│  │   ENGINE     │───▶│    ENGINE    │───▶│   BUILDER    │                  │
│  │              │    │              │    │              │                  │
│  │ • Exchange   │    │ • City snap  │    │ • Scene brief│                  │
│  │   playlist   │    │ • Local time │    │ • Caps enf.  │                  │
│  │ • SSOT order │    │ • Season     │    │ • Conflicts  │                  │
│  │ • Pointer    │    │ • Market mood│    │ • 4 variants │                  │
│  │              │    │ • Weather    │    │              │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                   │                          │
│         │                   │                   ▼                          │
│         │                   │          ┌──────────────┐                    │
│         │                   │          │  GENERATOR   │                    │
│         │                   │          │              │                    │
│         │                   │          │ • DALL·E API │                    │
│         │                   │          │ • Rate limit │                    │
│         │                   │          │ • Fallback   │                    │
│         │                   │          └──────────────┘                    │
│         │                   │                   │                          │
│         ▼                   ▼                   ▼                          │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                     STORAGE                                      │       │
│  │  • Image file (R2/S3)                                           │       │
│  │  • 4 prompts (canonical + 3 variants)                           │       │
│  │  • Scene brief JSON                                             │       │
│  │  • Provenance metadata                                          │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                     DISPLAY                                      │       │
│  │  • Toggle: Providers | Gallery (Pro)                            │       │
│  │  • Crossfade slideshow                                          │       │
│  │  • Metadata overlay                                             │       │
│  │  • 4 copy buttons                                               │       │
│  │  • Screensaver mode                                             │       │
│  │  • AI Provider Selector (Pro, 1-3 in Gallery)     ◀─── NEW     │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Hour timeline (Gallery Mode rotation):
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│:00 │:10 │:20 │:30 │:40 │:50 │:00 │:10 │:20 │:30 │:40 │:50 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ 🎨 │ 🎨 │ 🎨 │ 🎨 │ 🎨 │ 🎨 │ 🎨 │ 🎨 │ 🎨 │ 🎨 │ 🎨 │ 🎨 │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
  ↑    ↑    ↑    ↑    ↑    ↑    ↑    ↑    ↑    ↑    ↑    ↑
  Image generated every 10 minutes (6/hour, 144/day)
```

### Gallery Mode API Endpoints

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/api/gallery/current` | GET | Current image + metadata | 60/min per IP |
| `/api/gallery/library` | GET | Paginated archive | 30/min per IP |
| `/api/gallery/generate` | POST | Manual trigger (admin) | 1/10min global |
| `/api/gallery/status` | GET | Rotation status (debug) | 10/min per IP |

### Integration with Existing Feeds

Gallery Mode consumes data from existing Promagen feeds:

| Feed | Gallery Mode Use | Data Source |
|------|------------------|-------------|
| **Exchanges** | Rotation playlist, city metadata | `exchanges_catalog.json` |
| **FX** | Volatility detection, currency strength | `/api/fx` (TwelveData) |
| **Crypto** | Crypto pumping detection | `/api/crypto` (TwelveData) |
| **Commodities** | Gold rising/falling detection | `/api/commodities` (parked) |
| **Weather** | Atmosphere terms | `/api/weather` (Visual Crossing) |

### Market Mood Detection

The Market Mood Engine evaluates live data to determine the current mood:

```typescript
// Priority order (highest specificity first):
// 1. market_opening/closing (time-based)
// 2. crypto_pumping (BTC/ETH >5%)
// 3. gold_rising/falling (>1%)
// 4. currency_strength (USD/GBP/EUR)
// 5. high/low_volatility (FX)
// 6. neutral (fallback)

interface MarketMoodResult {
  primary: MoodType;
  secondary: MoodType | null;
  boostWeight: number;        // e.g., 1.3
  boosts: {
    colour: string[];         // ["golden", "warm"]
    atmosphere: string[];     // ["opulent", "prestigious"]
    lighting: string[];       // ["warm", "golden"]
    materials: string[];      // ["gold", "metallic"]
    style: string[];          // ["cinematic"]
  };
  source: string;             // "market_opening", "gold_rising", etc.
}
```

### File Structure

```
frontend/src/
├── lib/gallery/
│   ├── rotation-engine.ts      # Playlist management + pointer
│   ├── theme-engine.ts         # CitySnapshot builder
│   ├── prompt-builder.ts       # Scene Brief → 4 variants
│   ├── market-mood-engine.ts   # Live mood detection
│   ├── weather-integration.ts  # Weather → atmosphere mapping
│   ├── generator.ts            # DALL·E API + fallback
│   └── storage.ts              # R2 + database operations
│
├── lib/providers/
│   ├── sort.ts                 # Alphabetical sort, 123rf last
│   └── filter-prefs.ts         # Selection persistence
│
├── components/gallery/
│   ├── gallery-toggle.tsx      # Providers/Gallery switcher
│   ├── gallery-slideshow.tsx   # Image display + crossfade
│   ├── copy-prompt-button.tsx  # Tier-specific copy
│   └── gallery-upsell.tsx      # Free tier upsell panel
│
├── components/providers/
│   └── provider-filter-selector.tsx  # Provider dropdown
│
└── app/api/gallery/
    ├── current/route.ts        # Current image API
    ├── library/route.ts        # Library API
    ├── generate/route.ts       # Manual trigger (admin)
    └── status/route.ts         # Rotation status
```

### Storage Architecture

**Image Storage:** Cloudflare R2 (S3-compatible)
```
r2://promagen-gallery/
├── images/
│   ├── 2026-01-19/
│   │   ├── tse-tokyo-1705672800.webp
│   │   ├── lse-london-1705673400.webp
│   │   └── ...
└── metadata/
    └── (stored in Postgres)
```

**Metadata Storage:** Postgres (Vercel)
```sql
CREATE TABLE gallery_entries (
  id UUID PRIMARY KEY,
  exchange_id VARCHAR(50) NOT NULL,
  city VARCHAR(100) NOT NULL,
  generated_at TIMESTAMP NOT NULL,
  local_time TIMESTAMP NOT NULL,
  time_of_day VARCHAR(20) NOT NULL,
  season VARCHAR(20) NOT NULL,
  mood VARCHAR(50) NOT NULL,
  weather_conditions VARCHAR(100),
  weather_temp_c DECIMAL(4,1),
  image_url TEXT NOT NULL,
  prompt_tier1 TEXT NOT NULL,
  prompt_tier2 TEXT NOT NULL,
  prompt_tier3 TEXT NOT NULL,
  prompt_tier4 TEXT NOT NULL,
  scene_brief JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Cost Control

| Component | Daily Limit | Monthly Cost |
|-----------|-------------|--------------|
| DALL·E 3 | 144 images | ~$173 |
| R2 Storage | ~5GB | $0 (free tier) |
| Weather API | 144 calls | $0 (free tier) |
| Postgres | N/A | Included in Vercel |
| **Total** | | **~$175/month** |

### Caching Strategy

| Resource | Cache TTL | Strategy |
|----------|-----------|----------|
| Current image | 10 min | Stale-while-revalidate |
| Library entries | 1 hour | CDN edge cache |
| Weather data | 15 min | In-memory |
| Market mood | 5 min | In-memory |

### Security

- **API Keys:** OPENAI_API_KEY, VISUAL_CROSSING_API_KEY — server-side only
- **Rate Limiting:** All endpoints protected
- **Input Validation:** Zod schemas on all queries
- **Content Safety:** DALL·E safety filter always enabled

---
