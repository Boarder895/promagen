# Market Power Research Summary

**Date:** 27 January 2026  
**Researcher:** Claude (via web research)  
**Total Providers:** 42

---

## Research Methodology

Data was compiled from multiple authoritative sources:
- **Official company announcements** and press releases
- **Wikipedia** for founding dates and historical context
- **Tracxn, Crunchbase, PitchBook** for funding and company data
- **SimilarWeb, Statista** for user statistics
- **AIPRM, DemandSage** for AI-specific market statistics
- **Platform-specific stats** (Discord member counts, Reddit subscriber counts)

**Note:** Social follower counts are approximate snapshots and fluctuate. Estimated users represents Monthly Active Users (MAU) where available, or registered users otherwise.

---

## File Placement

Place these files in your frontend project:

```
frontend/
└── src/
    └── data/
        └── providers/
            ├── market-power.json          # Main data file
            ├── market-power.schema.json   # JSON Schema for validation
            └── market-power.types.ts      # TypeScript types
```

---

## Key Findings

### Tier 1: Incumbent Giants (100M+ users)
| Provider | Founded | Est. Users | Notes |
|----------|---------|------------|-------|
| OpenAI (DALL-E) | 2015 | 700M | Integrated into ChatGPT |
| Canva | 2013 | 220M | Acquired Leonardo AI |
| Picsart | 2011 | 150M | Mobile-first platform |
| Google Imagen | 1998 | 100M | Via Gemini ecosystem |
| Bing/Microsoft Designer | 1975/2009 | 100M | Uses DALL-E 3 |
| Meta Imagine | 2004 | 50M | Part of Meta AI |
| Freepik | 2010 | 50M | Stock + AI |

### Tier 2: Major Players (10M-50M users)
| Provider | Founded | Est. Users | Notes |
|----------|---------|------------|-------|
| Adobe Firefly | 1982 (2023 launch) | 32.5M | 29% market share |
| Midjourney | 2021 | 20M | Discord-first, $500M revenue |
| Leonardo AI | 2022 | 19M | Acquired by Canva |
| Fotor | 2012 | 20M | Photo editing + AI |
| Pixlr | 2008 | 15M | Browser-based editor |
| Photoleap | 2020 | 10M | Mobile-first |
| Remove.bg | 2018 | 10M | Utility tool |
| Stability AI | 2019 | 10M | 80% of AI images use SD |

### Tier 3: Emerging Players (1M-10M users)
| Provider | Founded | Est. Users | Notes |
|----------|---------|------------|-------|
| NightCafe | 2019 | 5M | 23% market share |
| 123RF | 2005 | 5M | Stock + AI |
| VistaCrete | 2016 | 5M | Canva competitor |
| PicWish | 2020 | 5M | Photo editing |
| Flux (BFL) | 2024 | 5M | Open-source, $3.25B valuation |
| Runway | 2018 | 5M | Video + image, $4B valuation |
| Ideogram | 2022 | 3M | Text rendering specialty |
| Artbreeder | 2018 | 3M | Collaborative remix |
| Clipdrop | 2020 | 3M | Owned by Stability AI |
| Visme | 2013 | 3M | Presentations focus |
| Craiyon | 2021 | 3M | Free tier focus |

### Tier 4: Niche/Emerging (Under 1M users)
BlueWillow, Dreamlike, ArtGuru, Hotpot, GetImg, Lexica, etc.

---

## Market Power Index (MPI) Implications

Based on this research, MPI calculations will apply handicaps:

**Low MPI (1.0-2.0)** - Small newcomers get BONUS multiplier:
- ArtGuru, Artistly, Hotpot, Dreamlike

**Mid MPI (2.5-3.5)** - Fair competition zone:
- Ideogram, Playground, OpenArt, GetImg, Jasper Art

**High MPI (4.0-5.0)** - Giants get REDUCED points per engagement:
- OpenAI, Google, Adobe, Microsoft, Meta, Canva

---

## Data Freshness

**Recommendation:** Re-research quarterly (every 90 days) as:
- User counts change significantly
- New funding rounds occur
- Acquisitions happen (e.g., Leonardo → Canva)
- Social follower counts fluctuate

The `lastResearched` field in JSON tracks when data was last updated.

---

## Validation

Run TypeScript compilation to validate types:
```powershell
# Run from: frontend/
npx tsc --noEmit src/data/providers/market-power.types.ts
```

JSON Schema validation can be added to cron job initialization.
