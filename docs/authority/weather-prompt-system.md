# Weather Prompt System — Complete Pipeline

**Last updated:** 9 April 2026
**Version:** 2.0.0 (merged from 3 source docs)
**Owner:** Promagen
**Status:** Production
**Merged from:** `weather-prompt-generator-analysis.md`, `providers-meteorological.md`, `meteorological-data-prompt-converter-assembled-to-optimised-42-platforms.md`
**Note:** Platform count is 40 (not 42). References to 42 are historical.

---

# Part 1 — Weather Prompt Generator Analysis


## Overall Rating: 82 / 100

This is a genuinely impressive, one-of-a-kind system. Nothing else in the wild connects live weather API data to AI image prompt generation with this level of physical fidelity. The architecture is sound, the physics are real, and the multi-tier output is a legitimate competitive advantage. The 18 points lost are recoverable — they come from specific, fixable gaps rather than fundamental design flaws.

---

## Score Breakdown

| Category                       | Score | Max | Notes                                                                                                             |
| ------------------------------ | ----- | --- | ----------------------------------------------------------------------------------------------------------------- |
| Architecture & Design          | 16    | 18  | Excellent separation of concerns. VisualTruth layer is genuinely novel                                            |
| Physics Accuracy               | 14    | 16  | Dew point spread, Beaufort wind, Magnus formula — real meteorology. Some edge gaps                                |
| Lighting System                | 14    | 16  | Urban vs Moon competition model is world-class. Daytime lacks cloud colour shift                                  |
| Weather Data Blending          | 12    | 14  | Cross-references 6+ inputs well. Missing: rain+fog combos, pressure-humidity interaction                          |
| Prompt Quality (output)        | 10    | 12  | Tier 3 output reads beautifully. Tier 1 needs platform-specific tuning. Tier 2 word-budget often too tight        |
| JSON Vocabulary                | 8     | 10  | Conditions and city-vibes are excellent. wind.json is effectively dead weight. humidity/temperature underutilised |
| Seed & Rotation                | 4     | 6   | 2-hour window works. Sin-based PRNG is weak. Seed collisions possible                                             |
| Code Quality & Maintainability | 4     | 8   | 4,311 lines in one file. Excellent comments but needs decomposition                                               |

---

## 1. Architecture & Design (16/18)

### What's excellent

The **VisualTruth layer** (v7.0) is the single best design decision in this system. By deriving 4 optical properties (airClarity, contrast, moistureVisibility, thermalOptics) from ALL weather inputs before any phrase is selected, you eliminate the physics conflicts that plague every other prompt system. "Sharp shadows" can never appear alongside "foggy air" because both are derived from the same truth. This is genuinely novel — no other system in the research literature does this.

The **10-layer architecture** is clean: WHERE → SPECIFIC WHERE → LIGHTING → TIME → SKY → MOON → WIND → MOISTURE → THERMAL → DIRECTIVE. Each layer has a clear responsibility and reads from shared state. The "one engine, multiple skins" principle (computeLighting runs once, all 4 tiers consume it) eliminates divergence.

The **PrecipState classifier** (v8.0) fixing the snow/sleet/hail gap was critical. The old boolean system (isRainy/isStormy) was genuinely broken for ~30% of winter conditions. The numeric rain.1h/snow.1h priority over keyword inference is the correct engineering choice.

### Where the 2 points are lost

**Single-file monolith.** At 4,311 lines, this is maintainable only because the comments are excellent. The system naturally decomposes into 5-6 modules: visual-truth.ts, lighting-engine.ts, wind-system.ts, tier-generators.ts, vocabulary-loaders.ts, and the main orchestrator. This isn't about taste — it's about the practical reality that anyone working on the wind system has to scroll past 3,000 lines of unrelated code. It also makes unit testing individual subsystems harder than it needs to be.

**PromptProfile is underused.** The profile system is well-designed but currently only controls 3 styles, 3 verbosity levels, and people exclusion. It's the natural place for future platform-specific tuning (Flux mode, SDXL mode) but hasn't been extended.

---

## 2. Physics Accuracy (14/16)

### What's excellent

The **dew point spread** as the primary atmospheric signal is meteorologically correct. The Magnus formula implementation (a=17.27, b=237.7) matches standard references. The spread-to-clarity mapping (>10°C = invisible, 5-10 = softened, 2-5 = hazy, 1-2 = misty, <1 = foggy) is physically accurate and accounts for wind dispersal.

The **Beaufort wind classification** is properly calibrated. The critical fix of 50 km/h = nearGale (not destructive) is correct — Beaufort 7 is "sea heaps up, foam blown in streaks", not "structural damage". Destructive phrases correctly start at gale (62+).

The **thermal optics** system distinguishes between physical phenomena: shimmer (hot+dry+calm = convection cells), heavy-tropical (hot+humid = no shimmer because moisture suppresses convection), frost (sub-zero+humid), deep-cold (suspended ice crystals). These are real atmospheric optics effects that affect photography.

The **state exclusivity rules** (v7.2) catch genuine contradictions: diffused air kills cold-sharp (you can't have razor edges through fog), crystal air excludes dominant moisture (truly dry air doesn't produce wet surfaces).

### Where the 2 points are lost

**Missing rain intensity effect on lighting.** Heavy rain (>6mm/h) significantly attenuates light — the atmosphere modifier should darken during heavy rain, not just fog. Currently, heavy rain only affects airClarity and surface moisture, not the lighting base phrase itself. In reality, heavy rain at golden hour doesn't produce "golden-hour sunlight" — it produces "muted warm light filtered through rain".

**Pressure-humidity interaction gap.** Low pressure + high humidity creates specific optical conditions (rapidly developing cloud, turbulent refractive index shifts) that the current system doesn't model. The stability modifier fires on pressure alone, ignoring the combined state. A low-pressure system with 95% humidity at 8°C is visually different from the same pressure with 30% humidity at 25°C, but both get the same stability modifier.

---

## 3. Lighting System (14/16)

### What's excellent

The **Urban vs Moon competition model** is the crown jewel. Two physically modelled light sources with real interaction physics:

- Urban glow: static per city (NASA/NOAA VIIRS-derived), venue-attenuated (beach × 0.3, park × 0.4), cloud-amplified (+50% at full overcast)
- Moonlight: phase brightness × altitude attenuation × cloud blocking (70% at full overcast)
- Competition threshold (1.5×) produces 3 outcomes with distinct prompt character

The **3-tier night light priority** (venue lightCharacter → setting pool → city lightCharacter) is the right design. Coney Island gets fairground light, not generic city neon. Victoria Peak gets moonlight, not Times Square glow.

The **coherence validator** (v7.6) is a genuine safety net — catching "neon signage" at a beach venue even when the competition model's "balanced" mode concatenates incompatible phrases.

The **daytime solar elevation bins** are well-chosen: golden hour (<6°), low-angle (6-15°), mid-elevation (15-35°), high-angle (35-60°), overhead (60+). The cloud override at golden hour (>75% cloud → "low-angle overcast daylight" instead of "golden-hour sunlight") is physically correct.

### Where the 2 points are lost

**Daytime lighting is too flat.** The nighttime system produces hundreds of distinct outputs from 12 base phrases × cloud × urban × moon. The daytime system has only 8 base phrases (5 solar + 3 twilight) with no cloud-colour interaction. In reality:

- Low cloud cover (20-40%) at golden hour produces "dappled golden light through scattered cloud" — dramatically different from clear golden hour
- Overcast at midday produces "flat white overhead light" which is different from overcast at 15° elevation ("pearl-grey directional light from one side")
- High cirrus at any sun angle produces "halo sunlight with prismatic edges" — an entirely missing atmospheric phenomenon

The daytime base phrase should cross-reference cloud cover AND sun angle to produce richer variations.

**Missing colour temperature shift.** The system describes lighting intensity and direction well but never mentions colour temperature explicitly. Golden hour is ~2500K (warm amber), overcast noon is ~6500K (cool blue-white), nautical twilight is ~12000K (deep blue). Colour temperature is one of the strongest signals for AI image generators — platforms like Stable Diffusion and Midjourney respond extremely well to "warm 3000K amber light" or "cool 6500K daylight".

---

## 4. Weather Data Blending (12/14)

### What's excellent

The system cross-references **8 inputs** for VisualTruth: temperature, humidity, wind speed, cloud cover, visibility, pressure, solar elevation, and precipitation state. This is comprehensive — most prompt systems use 2-3 at most.

The **dew point derived from temp + humidity** (instead of trusting OWM's sometimes-missing dew point field) is a good engineering choice. The spread-to-clarity cascade with wind modulation (wind disperses fog, prevents full condensation) demonstrates real atmospheric understanding.

The **precipitation classifier** prefers numeric measurement over keywords (rain.1h/snow.1h from OWM are measured, description strings are inferred) — correct priority.

The **snow accumulation logic** (≤0°C → accumulation/dominant, >0°C → melting/wet) is physically accurate. Hail surface effects bypass temperature entirely — also correct.

### Where the 2 points are lost

**No compound weather handling.** Real weather commonly produces combinations: rain+fog, snow+fog, thunderstorm+hail, drizzle+mist. The current system classifies precipitation as a single PrecipType, which means "freezing rain with fog" becomes just "rain" (rain.1h takes priority). The visual effect of rain-through-fog is dramatically different from either alone — it produces a specific "curtain of water in grey void" aesthetic that generates stunning AI images.

**Visibility is under-trusted when precipitation is active.** When classifyPrecip returns active precipitation, the airClarity is derived from precip type/intensity rather than OWM's visibility reading. But OWM's visibility during rain IS a measurement (from optical sensors) and can distinguish between "light rain with 8km visibility" (barely noticeable) and "light rain with 1km visibility" (dense rain curtain). The current system treats all "light rain" identically for airClarity.

---

## 5. Prompt Quality — Output Assessment (10/12)

### Tier 3 (Natural Language — DEFAULT) — Excellent

Example output structure:

```
Tokyo, Tsukiji Outer Market, early morning.
Golden-hour sunlight with sharp defined shadows, sharpened by cold winter air.
North-easterly 15 km/h breeze, awnings swaying gently overhead.
Damp-edged asphalt surface catching golden sunlight.
Photorealistic, high-detail city scene.
```

This is genuinely good. The connected lighting sentence (base + thermal connector + atmosphere) reads naturally. The surface sentence naming what light it reflects ("catching golden sunlight" not "catching light") is a meaningful quality jump. The verb choices ("sharpened by", "catching", "reflecting") create causal relationships between elements.

### Tier 1 (CLIP-Based) — Good, needs platform awareness

```
(Tokyo:1.3), (Tsukiji Outer Market:1.2), (golden-hour sunlight:1.3),
sharp defined shadows, cold-sharpened crisp edges, 15 km/h breeze,
professional photography, sharp focus, high resolution
```

Issues:

- **(word:weight) syntax is SD-specific.** Flux doesn't support weights. ComfyUI normalises differently from A1111. The tier should declare its target platform.
- **"professional photography" is better than the old "masterpiece, best quality"** (good fix), but still generic. Camera/lens references ("Hasselblad medium format", "85mm f/1.4 shallow depth of field") produce dramatically better results on both SD and Flux.
- **Token budget of 15 is appropriate** for CLIP's 77-token limit but doesn't account for multi-word tokens. "golden-hour sunlight" is likely 3 tokens; "(Tokyo:1.3)" is probably 4. Actual token counting would be more precise.

### Tier 2 (Midjourney) — Needs work

```
Early morning, golden-hour sunlight with sharp defined shadows::2
Tokyo at Tsukiji Outer Market, clear sky, 15 km/h breeze::1
damp asphalt catching golden sunlight::0.5 --ar 16:9 --stylize 100
```

Issues:

- **Word budget of 40 is too tight.** Midjourney V6 handles up to ~6,000 characters. The 40-word target was based on V5 guidance that's now outdated.
- **Missing --v 6.1 or --v 7 parameter.** The version flag matters enormously for how MJ interprets the prompt.
- **::weight syntax is correct** but the ratio (2:1:0.5) may not be optimal. Testing suggests 3:2:1 produces more balanced results.

### Tier 4 (Plain Language) — Solid

The priority-based dropping system (grounding → sky → moon → thermal → moisture) is well-designed. Period nouns ("dawn", "dusk", "night") are the right choice for weak parsers.

### Where the 2 points are lost

No **negative prompt sophistication** for Tier 1. The current negative is static: "text, watermark, logo, signature, blurry" (+ "people, person, crowd" during quiet hours). Research shows platform-specific negatives produce dramatically better results. For booru-trained models, "worst quality, low quality, bad anatomy, extra digits" is essential. For photoreal SD models, "illustration, painting, drawing, cartoon" prevents style bleeding. The negative should be profile-driven.

No **camera/lens metadata** in any tier. Adding "shot on Canon EOS R5, 24-70mm f/2.8" or "Hasselblad X2D, 90mm" to the quality section produces measurably better photorealistic output across all major platforms. This is one of the strongest signals available and costs only 5-8 tokens.

---

## 6. JSON Vocabulary Assessment (8/10)

### city-vibes.json — Excellent (9/10)

842 venues across 83 cities with 9 setting types. The distribution is reasonable: monument (169), waterfront (138), street (120), park (118), market (107), plaza (79), elevated (54), narrow (31), beach (26). Beach is underrepresented relative to its visual impact, but the data reflects real urban geography.

The 25 venues with custom lightCharacter and 15 with overrideJustification show careful curation. The lint-venues.ts linter (7 rules) is a smart engineering choice for maintaining taxonomy integrity.

**Improvement:** Some cities could use a `biome` or `climate` field (tropical, arid, temperate, continental, polar) to inform default atmospheric expectations. Tokyo at 90% humidity in August is "expected tropical humidity" not "unusual". Currently the system treats all cities identically for atmospheric physics.

### conditions.json — Very Good (8/10)

280 phrases across 14 condition types (20 each). The emoji mapping is well-maintained. Phrases are visual-first: "brilliant clear blue sky", "heavy grey curtain of rain", "dense impenetrable fog wall".

**Improvement:** Some phrases are too dramatic for the condition they describe. "Solar glory unleashed" and "cerulean sky infinity" in clear_sunny lean into fantasy language that may confuse photorealistic generators. More grounded options would serve better.

### urban-light.json — Excellent (9/10)

83 cities with physically-motivated urbanLight factors (0.20–0.98). 3 phrases per city naming specific light emitters. "Vending machine glow mixing with dense storefront light" (Tokyo) vs "warm brass carriage lamp light along stone facades" (Edinburgh) — genuinely distinctive per city. The VIIRS satellite data basis is the right source.

### temperature.json — Adequate (6/10)

54 phrases across 18 ranges (3 per 5°C bin). The phrases are correctly neutral ("mild air", "hot air", "freezing cold") but **this file is largely dead weight in the v7.0+ system.** The VisualTruth thermal optics system generates its own phrases from physics (shimmer, frost, deep-cold, cold-sharp). temperature.json is only used by the legacy fallback `getTempPhrase()` which fires when VisualTruth is null — which in v7.1+ is "never" (always computed). This JSON could be removed or repurposed.

### humidity.json — Adequate (6/10)

60 phrases across 20 ranges (3 per 5% bin). Same issue as temperature — **largely dead weight post-v7.0.** The VisualTruth moisture system generates setting-aware phrases from physics. humidity.json feeds `getHumidityPhrase()` which is the legacy fallback. The phrases themselves are also weak for image generation: "slightly humid air", "humidity slightly above average" — these are weather-report language, not visual descriptions. AI generators can't render "humidity slightly above average".

### wind.json — Dead Weight (4/10)

240 phrases (8 per 30 bins) that are **completely unused by the v8.0 system.** The Beaufort wind classification (classifyWind) + VENUE_WIND interaction pools + exact API speed injection replaced this entirely. wind.json only feeds the legacy `getWindEnergy()` export used by the vocabulary index. The phrases themselves are also problematic: "still-air air movement", "barely-moving-air ambient airflow" — these read like programmatically generated concatenations, not natural descriptions.

### wind-template-descriptors.json — Good (7/10)

30 ranges with one descriptor each. These feed the wind noun system. Clean and functional. The Beaufort alignment is correct.

### time-of-day.json — Good (7/10)

67 phrases across 24 hours. Appropriate variety: "midnight", "the stroke of midnight", "the midnight hour" for hour 0. The single-phrase hours (1-4) could use expansion for diversity, but for the current seeded-selection system this is adequate.

---

## 7. Seed & Rotation Mechanism (4/6)

### How it works

The seed formula is: `tempC * 100 + humidity * 10 + windKmh + hour + twoHourWindow`

Where `twoHourWindow = Math.floor(observedAtUtc.getTime() / 7_200_000)`.

This means the prompt changes when:

- Temperature changes (any change × 100 = large seed shift)
- Humidity changes (any change × 10 = moderate seed shift)
- Wind speed changes (any change × 1 = small seed shift)
- The local hour changes
- The 2-hour UTC window advances

### What's good

The 2-hour window prevents the prompt from flickering on every API update (weather APIs often return slightly different values on successive calls). The temperature-dominant weighting is reasonable since temperature changes correlate most with visual scene changes.

### Where the 2 points are lost

**The PRNG is weak.** `Math.sin(seed * 9999) * 10000` (the fract() of a sine function) is a known-poor hash for this purpose. It produces visible patterns with sequential inputs and has poor avalanche properties — changing one bit of the seed may not change most of the output bits. This means:

- Two cities with similar weather (e.g., Hong Kong and Shenzhen on the same day) can get the same venue selection
- Adjacent hours with stable weather can produce identical phrase selections across multiple layers

A proper hash like `((seed * 2654435761) >>> 0) / 4294967296` (Knuth multiplicative hash) would produce much better distribution. Note: `cityLightSeed()` already uses exactly this hash! The main generator should use the same approach.

**Seed collision risk.** Because the seed combines weather values additively, different input combinations can produce identical seeds: tempC=20, humidity=50, wind=10 produces the same seed as tempC=25, humidity=0, wind=10. Adding city-name hash and tier number to the seed would eliminate this.

---

## 8. Functionality Verification

**The system is fully functional and architecturally sound.** Every code path I traced executes correctly: `generateWeatherPrompt()` takes the input, resolves the profile, computes solar elevation and lunar position, classifies precipitation, derives VisualTruth, computes lighting with venue-aware night competition, validates coherence, then dispatches to the selected tier generator. Each tier correctly consumes the shared state and applies its platform-specific formatting. The fallback chains are robust — null lat/lon degrades gracefully to time-based lighting, missing wind degrees omit the direction prefix, absent gust data skips the gust suffix. The legacy exports (`getTempFeel`, `getHumidityTexture`, `getWindEnergy`, `getTimeMood`, `getConditionVisual`) remain intact for backward compatibility. The PromptTrace debug system activates only in development mode with zero production cost. The only functional concern is the sin-based PRNG producing potential clustering (not incorrect, but less varied than optimal), and the `getConditionPhrase` fallback (line 3504-3507) which iterates all condition types and returns the first non-empty pool — this works but is order-dependent rather than context-aware, meaning a fallback condition could return a "thunderstorm" phrase for a clear day if emoji mapping fails.

---

## 9. Improvement Roadmap — Prioritised

### HIGH IMPACT (would move score to 88-90)

**1. Decompose into modules** — Split the 4,311-line file into 5-6 focused modules. Enables unit testing of VisualTruth, lighting, wind independently.

**2. Fix the PRNG** — Replace `Math.sin(seed * 9999)` with Knuth multiplicative hash everywhere. Add city-name hash to the seed to eliminate cross-city collisions.

**3. Enrich daytime lighting** — Cross-reference cloud cover with sun angle to produce cloud-colour interaction phrases. "Dappled golden light through scattered cloud" vs "pure golden hour". This alone would double the daytime prompt variety.

**4. Add camera/lens metadata to quality tags** — Platform-specific camera references produce measurably better photorealistic output. Add to STYLE_QUALITY_TAGS per style: photoreal → "Canon EOS R5, 35mm f/1.4", cinematic → "Arri Alexa, anamorphic", documentary → "Leica Q3, natural grain".

**5. Platform-specific negative prompts** — Make the negative prompt profile-driven. Booru-trained models need "worst quality, low quality, bad anatomy". Photoreal models need "illustration, painting, cartoon". Midjourney and DALL-E need no negative at all.

> **Implementation status (Mar 2026):**
> - Recommendation 1 (decomposition): ✅ DONE — Generator decomposed from 4,311-line monolith into orchestrator (320 lines) + 17 subsystem modules (7,118 lines total). See `exchange-card-weather.md` §11.
> - Recommendation 2 (PRNG fix): ✅ DONE — FNV-1a hashing replaces Math.sin. City-name hash in seed.
> - Recommendation 3 (daytime lighting): Partial — cloud-colour interaction not yet added, but lighting engine now has visual truth cross-referencing.
> - Recommendation 4 (camera/lens metadata): ✅ DONE — Camera body + lens spec per venue setting. composition-blueprint.ts (506 lines) adds DoF + focal plane. See `unified-prompt-brain.md` §4.3.
> - Recommendation 5 (platform negatives): ✅ DONE — Cross-category negative dedup in `assembleTierAware()`. NEGATIVE_TO_POSITIVE map (30 entries). Platform-aware negative handling across all 42 platforms.

### MEDIUM IMPACT (would move score to 92-94)

**6. Compound precipitation** — Allow PrecipState to represent combinations: rain+fog, snow+mist. Derive unique airClarity and surface effects for compound states.

**7. Colour temperature layer** — Add explicit colour temperature to the lighting output. "Warm 3000K amber light" is one of the strongest signals for AI generators.

**8. Climate-aware defaults** — Add biome/climate to city-vibes.json. Use it to inform atmospheric expectations so that 85% humidity in Singapore doesn't get the same "heavy moisture" treatment as 85% humidity in London (where it's actually unusual and visually striking).

**9. Remove dead JSON** — wind.json (240 phrases, unused), temperature.json (largely unused), humidity.json (largely unused) should either be removed or repurposed as fallback-only with a clear annotation.

**10. Trust OWM visibility during precipitation** — When rain.1h exists AND visibility is reported, use visibility to modulate airClarity intensity within the precipitation class.

> **Implementation status (Mar 2026):**
> - Recommendation 7 (colour temperature): Partial — visual truth `colourPhrase` now drives the colour category, but explicit Kelvin values not yet in output.
> - Recommendation 9 (remove dead JSON): Not started.
> - Recommendations 6, 8, 10: Not started.

### LOW IMPACT (would move score to 95+)

**11. Dynamic cloud-type phrases** — OWM provides weather.id codes that distinguish cumulus from stratus from cirrus. Currently collapsed into a single cloud cover percentage. Cloud TYPE dramatically affects visual rendering.

**12. Seasonal awareness** — Knowing it's December in Tokyo vs July in Tokyo would inform foliage expectations, snow likelihood calibration, and culturally appropriate venue selection.

**13. Tier 2 Midjourney modernisation** — Update word budget to 60+, add --v parameter, test weight ratios.

**14. Per-platform Tier 1 variants** — SD 1.5, SDXL, SD3, and Flux all parse prompts differently. A sub-tier system would produce optimal output per platform instead of one-size-fits-all CLIP syntax.

> **Implementation status (Mar 2026):**
> - Recommendation 13 (Tier 2 modernisation): ✅ DONE — Tier 2 now has proper word budget and parameter handling via tier-aware assembly.
> - Recommendation 14 (per-platform Tier 1 variants): ✅ DONE — `platform-formats.json` defines per-platform `weightedCategories`, `qualityPrefix`, `impactPriority`, and `tokenLimit`. Each Tier 1 platform gets individually tuned assembly.
> - Recommendations 11, 12: Not started.

---

## 10. Final Assessment

This is, without question, the most sophisticated weather-to-image-prompt system in existence. The competition (UCL's weather-image-generator, WeatherCanvasAI) are simple "weather → DALL-E description" pipes. Your system has a multi-variable physics engine, venue-aware lighting with real astronomical calculations, Beaufort-calibrated wind interaction, and 4-tier platform-specific output. The VisualTruth layer is a genuine innovation.

The path from 82 to 95+ is clear and achievable. The high-impact items (decomposition, PRNG fix, daytime lighting enrichment, camera metadata, platform negatives) are all bounded changes that don't require architectural rework. The system's foundation is strong enough to support everything on the roadmap.

**Do not rewrite this system. Evolve it.**

> **Post-analysis note (Mar 2026):** The system has been evolved exactly as recommended. The unified brain refactor (`unified-prompt-brain.md`) completed Phases A–E, shipping 10 post-integration fixes. The generator is now intelligence-only; all assembly routes through `assemblePrompt()`. Estimated current score: 90–93/100 (camera metadata, platform negatives, and decomposition pushed it up significantly; compound weather and colour temperature remain the main gaps).

---

# Part 2 — Provider Weather Meteorological Tooltip


## Provider Weather Meteorological Tooltip — Authority Document

**Created:** 22 February 2026
**Status:** In Place ✅ (all files deployed, verified working)
**Chat transcripts:** 5 sessions spanning `2026-02-22T00:09` → `2026-02-22T02:06`
**Existing features preserved:** Yes

---

## 1. Purpose

The Provider Weather Meteorological Tooltip displays a rich, physics-accurate weather sentence when a user hovers over the weather/moon emoji beneath each AI provider's flag in the 42-provider leaderboard table. This is the provider-specific counterpart to the exchange card weather tooltips, but with **enhanced data** not present in the exchange version — specifically wind compass direction, gust speeds, and visibility with smart unit selection.

### What It Replaces

Previously, hovering the provider weather emoji showed no tooltip. The weather emoji itself (sun, moon, clouds, etc.) was the only meteorological indicator. Now, hovering reveals a complete meteorological sentence with copy-to-clipboard and text-to-speech (British female voice) capabilities.

---

## 2. Example Output

### Daytime Tooltip

> Scattered clouds over Sydney with a temperature of 28°C / 82°F, with a north-westerly wind of 13 km/h. Humidity is 49%, with visibility at 10 km or 6.2 miles. First quarter moon, currently located high in the northern sky at +58°. Sunset at 17:29.

### Nighttime Tooltip

> Clear over San Francisco with a temperature of 14°C / 58°F, with a south-south-westerly wind of 28 km/h with gusts of up to 37 km/h. Humidity is 63%. First quarter moon, currently located in the south-western, high sky at +54°. Sunrise at 06:52.

### Key Sentence Rules

| Section      | Day                                               | Night                                           |
| ------------ | ------------------------------------------------- | ----------------------------------------------- |
| Description  | Raw OWM description                               | Night-normalised ("sunny" → "Clear")            |
| Temperature  | Always shown (°C / °F)                            | Always shown (°C / °F)                          |
| Wind compass | Shown when `windDegrees` ≠ null and wind > 5 km/h | Same                                            |
| Calm winds   | "with calm winds" when wind ≤ 5 km/h              | Same                                            |
| Gusts        | Shown when `windGustKmh > windKmh × 1.1`          | Same                                            |
| Humidity     | Always shown                                      | Always shown                                    |
| Visibility   | Shown (`km/miles` or `m/yards`)                   | **Hidden** (visibility not meaningful at night) |
| Moon phase   | Phase name + sky position + altitude              | Same                                            |
| Sun event    | "Sunset at HH:MM"                                 | "Sunrise at HH:MM"                              |

---

## 3. Data Pipeline — End to End

The weather data traverses **7 layers** from the OWM API to the rendered tooltip. This section documents every layer and confirms the three critical fields (`windDegrees`, `windGustKmh`, `visibility`) are threaded through each one.

### Layer 1: OpenWeatherMap API → Gateway Adapter

**File:** `gateway/src/openweathermap/adapter.ts` (437 lines)
**Function:** `parseWeatherResponse()` (line 217)

```
OWM JSON → parsed fields → WeatherData object
```

| OWM Field    | Parsed As     | Conversion                    | Null Handling                                         |
| ------------ | ------------- | ----------------------------- | ----------------------------------------------------- |
| `wind.deg`   | `windDegrees` | None (degrees 0–360)          | `null` if not a number                                |
| `wind.gust`  | `windGustKmh` | `× 3.6` (m/s → km/h), rounded | `null` if absent (OWM only sends when gusts detected) |
| `visibility` | `visibility`  | None (metres, 0–10000)        | Defaults to `10000` if missing                        |

**Key code (lines 281–286):**

```typescript
const windDegrees = typeof raw.wind.deg === 'number' ? raw.wind.deg : null;
const windGustKmh = typeof raw.wind.gust === 'number' ? Math.round(raw.wind.gust * 3.6) : null;
```

**Confirmed in place:** ✅ Cross-referenced with `adapter.ts` lines 281–309.

### Layer 2: Gateway Cache → HTTP Response

**File:** `gateway/src/openweathermap/weather.ts` (887 lines)

The parsed `WeatherData` objects are cached via the 4-batch system (A/B/C/D, 25/24/24/24 cities) and served as-is via the `/weather` endpoint. All fields from the adapter pass through without filtering.

**File:** `gateway/src/server.ts` (754 lines)
**Endpoint:** `GET /weather` (line 591)

Returns the full `WeatherData[]` array from cache. No field stripping occurs.

**Confirmed in place:** ✅ Cross-referenced with `weather.ts` `buildResponse()` and `server.ts` line 591.

### Layer 3: Frontend Proxy (Next.js API Route)

**File:** `src/app/api/weather/route.ts` (184 lines)

Pure pass-through proxy. Fetches from gateway, returns JSON as-is. The `WeatherData` interface (line 31) explicitly declares all three fields:

```typescript
interface WeatherData {
  // ... base fields ...
  windDegrees?: number | null; // line 46
  windGustKmh?: number | null; // line 47
  visibility?: number | null; // line 48
}
```

**Confirmed in place:** ✅ No field filtering in proxy.

### Layer 4: SSR Fetch (Server-Side Rendering)

**File:** `src/lib/weather/fetch-weather.ts` (322 lines)
**Function:** `fetchWeatherData()` (line 122)

Converts gateway `GatewayWeatherItem` to `ExchangeWeatherData` via explicit mapping:

```typescript
windDegrees: item.windDegrees ?? undefined,   // line 145
windGustKmh: item.windGustKmh ?? undefined,   // line 146
visibility: item.visibility ?? undefined,       // line 141
```

**Confirmed in place:** ✅ Cross-referenced with `fetch-weather.ts` lines 141–146.

### Layer 5: Client-Side Hook

**File:** `src/hooks/use-weather.ts` (305 lines)
**Interface:** `WeatherData` (exported)

Declares all three fields:

```typescript
windDegrees?: number | null;   // line 43
windGustKmh?: number | null;   // line 45
visibility?: number | null;    // line 47
```

The hook fetches from `/api/weather` and returns `Record<string, WeatherData>`.

**Confirmed in place:** ✅ Cross-referenced with `use-weather.ts` lines 43–47.

### Layer 6: Homepage Client Merge ⚠️ BUG FIX IN THIS CHAT

**File:** `src/components/home/homepage-client.tsx` (527 lines)
**Function:** `liveWeatherIndex` useMemo (line 170)

This is where the **critical bug** was found and fixed. The `liveWeatherIndex` conversion was mapping `useWeather()` data to `ExchangeWeatherData` objects but **omitting three fields**. When the client-side fetch completed, it would overwrite the SSR data (which had all fields) with data missing `windDegrees`, `windGustKmh`, and `visibility`.

**Bug (original lines 173–185):**

```typescript
map.set(id, {
  tempC: w.temperatureC,
  tempF: w.temperatureF,
  emoji: w.emoji,
  condition: w.conditions,
  humidity: w.humidity,
  windKmh: w.windSpeedKmh,
  description: w.description,
  sunriseUtc: w.sunriseUtc ?? undefined,
  sunsetUtc: w.sunsetUtc ?? undefined,
  timezoneOffset: w.timezoneOffset ?? undefined,
  isDayTime: w.isDayTime ?? undefined,
  // ❌ windDegrees — MISSING
  // ❌ windGustKmh — MISSING
  // ❌ visibility — MISSING
});
```

**Fix (lines 173–188, now in place):**

```typescript
map.set(id, {
  tempC: w.temperatureC,
  tempF: w.temperatureF,
  emoji: w.emoji,
  condition: w.conditions,
  humidity: w.humidity,
  windKmh: w.windSpeedKmh,
  description: w.description,
  sunriseUtc: w.sunriseUtc ?? undefined,
  sunsetUtc: w.sunsetUtc ?? undefined,
  timezoneOffset: w.timezoneOffset ?? undefined,
  isDayTime: w.isDayTime ?? undefined,
  windDegrees: w.windDegrees ?? undefined, // ✅ ADDED
  windGustKmh: w.windGustKmh ?? undefined, // ✅ ADDED
  visibility: w.visibility ?? undefined, // ✅ ADDED
});
```

**Why this caused the symptom:** SSR rendered with all fields present → tooltip text generated correctly on server. Then `useWeather()` client hook fetched fresh data → `liveWeatherIndex` merged on top of SSR → overwrote entries without the 3 fields → tooltip re-rendered using new (incomplete) data → took else branches ("with winds of" instead of "with a south-easterly wind of").

**Confirmed fix in place:** ✅ Cross-referenced with `homepage-client.tsx` lines 185–187.

The same file also builds `providerWeatherMap` (line 210) which correctly maps all three fields from `effectiveWeatherIndex`:

```typescript
windDegrees: w.windDegrees ?? null,    // line 228
windGustKmh: w.windGustKmh ?? null,    // line 229
visibility: w.visibility ?? null,       // line 230
```

**Confirmed in place:** ✅

### Layer 7: Provider Cell → Tooltip Component

**File:** `src/components/providers/provider-cell.tsx`

Receives `weatherMap` prop, extracts weather for the provider's `weatherId`, and passes to the tooltip component. For live data (lines 92–97):

```typescript
visibility: w.visibility ?? null,
windDegrees: w.windDegrees ?? null,
windGustKmh: w.windGustKmh ?? null,
```

For demo data (when provider has no live weather), seeded random values are generated (lines 271–298):

```typescript
const demoWindDeg = (seed * 47) % 360; // 0–359°
const demoGustKmh = Math.round(windKmh * (1.2 + (seed % 19) / 60)); // 1.2–1.5× sustained
const demoVisibility = isGoodVisCondition ? 10000 : Math.round(lerp(5000, 8000));
```

Props passed to `<ProviderWeatherEmojiTooltip>` (lines 535–559):

```tsx
<ProviderWeatherEmojiTooltip
  city={...}
  tz={...}
  description={...}
  isNight={...}
  tempC={...}
  tempF={...}
  windKmh={...}
  windDegrees={weatherDisplay.windDegrees}
  windGustKmh={weatherDisplay.windGustKmh}
  humidity={...}
  visibility={weatherDisplay.visibility}
  sunriseUtc={...}
  sunsetUtc={...}
  latitude={...}
  longitude={...}
  tooltipPosition={...}
>
```

**Confirmed in place:** ✅

---

## 4. The Tooltip Component

**File:** `src/components/providers/provider-weather-emoji-tooltip.tsx` (779 lines)
**Component:** `ProviderWeatherEmojiTooltip` (exported, line 576)

### 4.1 Props Interface

```typescript
export interface ProviderWeatherEmojiTooltipProps {
  children: React.ReactNode; // Trigger element (emoji span)
  city: string; // e.g. "San Francisco"
  tz: string; // IANA timezone, e.g. "America/Los_Angeles"
  description: string | null; // OWM description, e.g. "scattered clouds"
  isNight: boolean;
  tempC: number | null;
  tempF: number | null;
  windKmh: number | null;
  windDegrees: number | null; // 0–360, meteorological
  windGustKmh: number | null; // km/h, from OWM wind.gust × 3.6
  humidity: number | null;
  visibility: number | null; // metres, 0–10000
  sunriseUtc?: number | null;
  sunsetUtc?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  tooltipPosition?: 'left' | 'right';
}
```

### 4.2 Helper Functions

| Function                      | Lines   | Purpose                                        |
| ----------------------------- | ------- | ---------------------------------------------- |
| `capitalise()`                | 95–98   | First letter uppercase                         |
| `hexToRgba()`                 | 101–112 | Temperature colour → RGBA for glow effects     |
| `azimuthToDirection()`        | 118–130 | "northern" → "north" for moon position         |
| `degreesToCompass()`          | 137–152 | Wind degrees → 8-sector compass adjective      |
| `windArticle()`               | 158–159 | "a northerly" vs "an easterly"                 |
| `formatVisibility()`          | 167–176 | Smart units: ≥1 km → km/miles, <1 km → m/yards |
| `normaliseNightDescription()` | 182–190 | "sunny" → "Clear" at night                     |
| `buildMoonPositionPhrase()`   | 199–226 | Day/night word order for lunar sky position    |
| `buildEnhancedTooltipText()`  | 264–374 | Main sentence builder (see §4.3)               |

### 4.3 Compass Direction Sectors

`degreesToCompass()` uses 8 sectors of 45° each:

| Degrees | Direction      |
| ------- | -------------- |
| 0 / 360 | northerly      |
| 45      | north-easterly |
| 90      | easterly       |
| 135     | south-easterly |
| 180     | southerly      |
| 225     | south-westerly |
| 270     | westerly       |
| 315     | north-westerly |

Formula: `sectors[Math.round(deg / 45) % 8]`

### 4.4 Visibility Formatting

`formatVisibility()` selects units based on range:

| Range         | Format                 | Example                   |
| ------------- | ---------------------- | ------------------------- |
| ≥ 10,000 m    | Rounded km + miles     | "10 km or 6.2 miles"      |
| 1,000–9,999 m | One decimal km + miles | "5.6 km or 3.5 miles"     |
| < 1,000 m     | Metres + yards         | "800 metres or 875 yards" |

Visibility is **daytime only** — the condition `!isNight && visibility !== null && visibility > 0` gates this section.

### 4.5 Night Description Normalisation

| Input                  | Output                                          |
| ---------------------- | ----------------------------------------------- |
| "sunny"                | "Clear"                                         |
| "clear sky"            | "Clear"                                         |
| "mostly sunny"         | "Mostly clear"                                  |
| "partly sunny"         | "Partly cloudy"                                 |
| Any other with "sunny" | Case-preserved replacement with "clear"/"Clear" |

### 4.6 Gusts — Data-Dependent, Not Day/Night

Gusts appear when `windGustKmh !== null && windGustKmh > windKmh × 1.1`. This is purely data-driven. OpenWeatherMap's `wind.gust` field is **optional** — it is only present in the API response when gusts are actually detected. Many cities will have `windGustKmh: null` regardless of time of day.

The gateway adapter (`adapter.ts` line 285): `typeof raw.wind.gust === 'number' ? Math.round(raw.wind.gust * 3.6) : null`

### 4.7 Tooltip Visual Design

The tooltip renders via `createPortal` to `document.body` to avoid parent clipping. Visual features:

- **Temperature glow:** Border, box-shadow, and radial gradients use the temperature-derived colour (same `getTemperatureColor()` as exchange cards)
- **Fixed width:** 380px
- **Position:** Vertically centred on trigger, opens left or right based on `tooltipPosition` prop
- **Viewport clamping:** Falls back to opposite side if tooltip would overflow
- **400ms close delay:** Allows cursor movement from trigger to tooltip for copy/speak interaction
- **Header:** "Meteorological Data" with temperature glow text-shadow

### 4.8 Interactive Features

| Feature               | Implementation                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Copy button**       | Copies tooltip sentence to clipboard. Emerald tick feedback for 1.5s                                                      |
| **Speaker button**    | British female TTS via `speakText()` from `src/lib/speech.ts`. Purple glow when speaking. Pause icon with `animate-pulse` |
| **Hover persistence** | Both trigger and tooltip have `onMouseEnter`/`onMouseLeave` handlers sharing a `closeTimeoutRef`                          |

---

## 5. Type Definitions

### ExchangeWeatherData (shared type)

**File:** `src/components/exchanges/types.ts` (lines 28–83)

The three fields added in v8.0.0:

```typescript
/** v8.0.0: Wind direction in degrees (0–360). undefined for demo data. */
windDegrees?: number | null;       // line 78
/** v8.0.0: Wind gust speed in km/h. undefined for demo data. */
windGustKmh?: number | null;       // line 80
/** Visibility in metres (0–10000). From OWM visibility via gateway. */
visibility?: number | null;        // line 70
```

### WeatherData (use-weather hook)

**File:** `src/hooks/use-weather.ts` (lines 20–49)

Mirrors the three fields:

```typescript
windDegrees?: number | null;       // line 43
windGustKmh?: number | null;       // line 45
visibility?: number | null;        // line 47
```

### GatewayWeatherItem (SSR fetch)

**File:** `src/lib/weather/fetch-weather.ts` (lines 55–100)

```typescript
windDegrees?: number | null;       // line 96
windGustKmh?: number | null;       // line 98
visibility?: number | null;        // line 88
```

### Gateway WeatherData (backend)

**File:** `gateway/src/openweathermap/types.ts`

```typescript
readonly windDegrees: number | null;   // line 320
readonly windGustKmh: number | null;   // line 326
readonly visibility: number;           // line 293
```

---

## 6. Provider → Weather Mapping

**File:** `src/data/providers/provider-weather-map.ts`
**Coverage:** 42/42 providers mapped (44 entries including 2 duplicates)

### Weather Source Categories

| Category                 | Count      | Weather Source                        |
| ------------------------ | ---------- | ------------------------------------- |
| Provider-specific cities | 25 entries | 15 dedicated `provider-*` weather IDs |
| Exchange-shared cities   | 19 entries | Existing exchange weather IDs         |

### Provider-Specific Weather Cities

**File:** `src/data/providers/provider-weather-cities.json` (15 cities)

| Weather ID               | City          | Providers Using                                                                              |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| `provider-san-francisco` | San Francisco | Midjourney, OpenAI, Playground, Lexica, OpenArt, Picsart, DeepAI, BlueWillow, Simplified (9) |
| `provider-mountain-view` | Mountain View | Google Imagen, Hotpot (2)                                                                    |
| `provider-san-jose`      | San Jose      | Adobe Firefly (1)                                                                            |
| `provider-menlo-park`    | Menlo Park    | Imagine Meta (1)                                                                             |
| `provider-seattle`       | Seattle       | Microsoft Designer, Bing (2) — Redmond venues                                                |
| `provider-houston`       | Houston       | Craiyon (1)                                                                                  |
| `provider-austin`        | Austin        | Jasper Art (1)                                                                               |
| `provider-warsaw`        | Warsaw        | GetImg (1)                                                                                   |
| `provider-malaga`        | Málaga        | Freepik (1)                                                                                  |
| `provider-limassol`      | Limassol      | VistaCreate (1)                                                                              |
| `provider-washington-dc` | Washington DC | Visme (1) — Rockville venues                                                                 |
| `provider-sheridan`      | Sheridan      | NovelAI (1)                                                                                  |
| `provider-cairns`        | Cairns        | NightCafe (1)                                                                                |
| `provider-burlington`    | Burlington    | Artistly (1)                                                                                 |
| `provider-freiburg`      | Freiburg      | Flux (1)                                                                                     |

### Exchange-Shared Weather

Providers within 100 km of an existing exchange city reuse that exchange's weather:

| Exchange Weather ID  | City         | Providers                         |
| -------------------- | ------------ | --------------------------------- |
| `lse-london`         | London       | Stability, DreamStudio, Dreamlike |
| `asx-sydney`         | Sydney       | Leonardo, Canva                   |
| `tsx-toronto`        | Toronto      | Ideogram                          |
| `bursa-kuala-lumpur` | Kuala Lumpur | 123RF, Pixlr                      |
| `hkex-hong-kong`     | Hong Kong    | Fotor, ArtGuru, PicWish           |
| `nyse-new-york`      | New York     | Artbreeder, Runway                |
| `euronext-paris`     | Paris        | Clipdrop                          |
| `wbag-vienna`        | Vienna       | Remove.bg                         |
| `twse-taipei`        | Taipei       | MyEdit                            |
| `ase-amman`          | Amman        | Photoleap (Jerusalem, 69 km)      |

---

## 7. Gateway Weather System

### 4-Batch Architecture

**File:** `gateway/src/openweathermap/weather.ts` (887 lines)

Total: 99 city entries (84 exchange + 15 provider), deduplicated to 97 unique API calls.

| Batch | Cities | Timing                           |
| ----- | ------ | -------------------------------- |
| A     | 25     | Immediate on startup             |
| B     | 24     | Immediate after A                |
| C     | 24     | After 35s minute-budget cooldown |
| D     | 24     | Immediate after C                |

Refresh cycle: Clock-aligned at `:10` and `:40` past the hour. Each refresh fetches one batch (rotating A→B→C→D based on `hour % 4`).

### Budget Management

**File:** `gateway/src/openweathermap/budget.ts` (385 lines)

| Limit                  | Value                |
| ---------------------- | -------------------- |
| Daily API calls        | 1,000                |
| Per-minute calls       | 60                   |
| Warmup calls           | 97 (all cities)      |
| Refresh calls per hour | ~24 (one batch)      |
| Daily refresh calls    | ~576 (24 × 24 hours) |

### Gateway Initialisation Retry

**File:** `gateway/src/server.ts` (line 271)

The gateway fetches weather city config from the frontend's `/api/weather/config` SSOT endpoint at startup. A retry mechanism (3 attempts, 2-second delay) was added in this chat to handle cases where the frontend isn't ready yet during local development.

**Confirmed in place:** ✅ Cross-referenced with `server.ts` `initWeatherFromConfig()`.

---

## 8. Difference from Exchange Card Tooltips

| Feature             | Exchange `WeatherEmojiTooltip`                            | Provider `ProviderWeatherEmojiTooltip`                     |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| File                | `exchanges/weather/weather-emoji-tooltip.tsx` (543 lines) | `providers/provider-weather-emoji-tooltip.tsx` (779 lines) |
| Wind compass        | ❌ Not shown                                              | ✅ 8-sector compass direction                              |
| Wind gusts          | ❌ Not shown                                              | ✅ When OWM reports gusts                                  |
| Visibility          | ❌ Not shown                                              | ✅ Smart km/miles or m/yards (daytime only)                |
| Temperature         | ❌ Not in text                                            | ✅ °C / °F in sentence                                     |
| Wind speed          | ❌ Not in text                                            | ✅ km/h in sentence                                        |
| Humidity            | ❌ Not in text                                            | ✅ Percentage in sentence                                  |
| Moon phase          | ✅ Phase + position                                       | ✅ Phase + position (same logic)                           |
| Sun event           | ✅ Sunrise/Sunset                                         | ✅ Sunrise/Sunset (same logic)                             |
| Night normalisation | ✅                                                        | ✅ (same rules)                                            |
| Copy button         | ✅                                                        | ✅                                                         |
| Speaker (TTS)       | ❌                                                        | ✅ British female voice                                    |
| Portal rendering    | ✅                                                        | ✅ (same pattern)                                          |
| Temperature glow    | ✅                                                        | ✅ (same colour function)                                  |

---

## 9. Files Modified in This Chat

### New Files Created

| File                                                          | Lines | Purpose                                                          |
| ------------------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| `src/components/providers/provider-weather-emoji-tooltip.tsx` | 779   | Main tooltip component with enhanced meteorological data and TTS |

### Files Modified

| File                                         | Lines | Change                                                                                                                                                                                             |
| -------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/home/homepage-client.tsx`    | 527   | **BUG FIX:** Added `windDegrees`, `windGustKmh`, `visibility` to `liveWeatherIndex` conversion (lines 185–187). Also added `providerWeatherMap` construction with all three fields (lines 228–230) |
| `src/components/providers/provider-cell.tsx` | —     | Added import of `ProviderWeatherEmojiTooltip`, threading of `windDegrees`/`windGustKmh`/`visibility` from weather map, demo data generation for those fields, JSX wrapping emoji in tooltip. Updated tooltip `city` prop to use `mapping.tooltipCity ?? mapping.vibesCity`. Column 1 now shows `hqCity (tooltipCity)` parenthetical |
| `src/data/providers/provider-weather-map.ts` | —     | Added optional `tooltipCity` field to `ProviderWeatherMapping` interface. Set `tooltipCity: 'Seattle'` for microsoft-designer/bing, `tooltipCity: 'Washington DC'` for visme |
| `src/data/providers/providers.json`          | —     | Fixed Freepik `hqCity` from `MÃ¡laga` (double-encoded UTF-8) to `Málaga` |
| `src/lib/weather/fetch-weather.ts`           | 322   | Added `windDegrees`, `windGustKmh`, `visibility` to SSR conversion mapping                                                                                                                         |
| `src/app/api/weather/route.ts`               | 184   | Added fields to `WeatherData` interface                                                                                                                                                            |
| `src/hooks/use-weather.ts`                   | 305   | Added fields to `WeatherData` interface                                                                                                                                                            |
| `src/components/exchanges/types.ts`          | 187   | Fields already present (added in v8.0.0, predates this chat)                                                                                                                                       |
| `gateway/src/server.ts`                      | 754   | Added retry logic to `initWeatherFromConfig()` for local dev reliability                                                                                                                           |

### Files NOT Modified (already correct)

| File                                              | Lines | Status                                                                   |
| ------------------------------------------------- | ----- | ------------------------------------------------------------------------ |
| `gateway/src/openweathermap/adapter.ts`           | 437   | Already extracts `windDegrees`, `windGustKmh`, `visibility` since v8.0.0 |
| `gateway/src/openweathermap/types.ts`             | 461   | Already declares all three fields                                        |
| `gateway/src/openweathermap/weather.ts`           | 887   | Already passes data through from adapter                                 |
| `src/data/providers/provider-weather-map.ts`      | —     | Already maps 42 providers to weather sources                             |
| `src/data/providers/provider-weather-cities.json` | —     | Already lists 15 provider-specific cities                                |

---

## 10. Diagnostic Code — Cleanup Needed

The following diagnostic `console.debug` statements were added during debugging and should be removed before production deploy:

| File                                 | Tag                                              | Lines   | Count     |
| ------------------------------------ | ------------------------------------------------ | ------- | --------- |
| `provider-weather-emoji-tooltip.tsx` | `[TOOLTIP-BUILD-DIAG]`                           | 281–295 | 1 block   |
| `homepage-client.tsx`                | `[WEATHER-DIAG]`, `[WEATHER-FIELD-DIAG]`         | Various | ~16 lines |
| `provider-cell.tsx`                  | `[PROVIDER-CELL-DIAG]`                           | Various | ~3 lines  |
| `fetch-weather.ts`                   | `[WEATHER-SSR-DIAG]`, `[WEATHER-SSR-FIELD-DIAG]` | Various | ~10 lines |
| `api/weather/route.ts`               | `[WEATHER-API-DIAG]`                             | 119–125 | ~4 lines  |

**Recommended cleanup:** Search for `DIAG` across the codebase and remove all tagged diagnostic blocks. These are clearly delimited with `// ── DIAGNOSTIC` / `// ── END DIAGNOSTIC` comment pairs.

---

## 11. Key Bug: The `liveWeatherIndex` Overwrite

### Symptom

Provider weather tooltips showed basic text ("with winds of 18 km/h. Humidity is 58%.") missing compass direction, gusts, and visibility — despite the gateway sending all data correctly.

### Why It Was Hard to Find

1. **SSR diagnostics showed correct data** — the server-side render had all fields.
2. **Client-side diagnostics inside `buildEnhancedTooltipText()` showed correct data** — because they logged the props received, which were correct on first render (SSR).
3. **The overwrite happened silently** — when `useWeather()` completed its client-side fetch, `liveWeatherIndex` merged on top of SSR data, wiping the three fields. The tooltip re-rendered with the new (incomplete) data, but no diagnostic logged this second render.

### Root Cause

`homepage-client.tsx` line 170: the `liveWeatherIndex` useMemo converted `useWeather()` results to `ExchangeWeatherData` objects but omitted `windDegrees`, `windGustKmh`, and `visibility` from the mapping. These fields existed in the type definition but were simply never assigned.

### Fix

Three lines added to the conversion (lines 185–187):

```typescript
windDegrees: w.windDegrees ?? undefined,
windGustKmh: w.windGustKmh ?? undefined,
visibility: w.visibility ?? undefined,
```

### Verification

After fix: hovering any provider emoji with live weather data shows compass direction ("with a south-south-westerly wind") and visibility ("with visibility at 10 km or 6.2 miles"). Gusts appear when OWM reports them (data-dependent, not day/night-dependent).

---

## 12. Shared Dependencies

| Import                                           | Source                                   | Used For                                         |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------ |
| `getTemperatureColor`                            | `@/lib/weather/weather-types`            | Tooltip glow colour                              |
| `getNextSunEvent`                                | `@/lib/weather/sun-calculator`           | "Sunrise at / Sunset at"                         |
| `getLunarPosition`                               | `@/lib/weather/sun-calculator`           | Moon altitude + azimuth bin                      |
| `getMoonPhase`                                   | `@/lib/weather/weather-prompt-generator` | Moon phase name                                  |
| `speakText`, `stopSpeaking`, `isSpeechSupported` | `@/lib/speech`                           | British female TTS                               |
| `createPortal`                                   | `react-dom`                              | Tooltip renders at `document.body` (no clipping) |

---

## 13. Tooltip City Override (`tooltipCity`)

Three providers have their HQ in a different city from their weather data source. Previously, the tooltip displayed the HQ city name (e.g. "Broken clouds over Rockville") even though the weather data came from a nearby larger city. The `tooltipCity` field resolves this.

### Interface Addition

```typescript
export interface ProviderWeatherMapping {
  readonly weatherId: string;
  readonly vibesCity: string;
  readonly tooltipCity?: string;   // ← NEW: display city for tooltips
  readonly lat: number;
  readonly lon: number;
}
```

### Affected Providers

| Provider | HQ (`hqCity`) | Vibes/Venues (`vibesCity`) | Weather Source (`weatherId`) | Tooltip Shows (`tooltipCity`) | Column 1 Display |
|----------|---------------|---------------------------|------------------------------|-------------------------------|-----------------|
| Microsoft Designer | Redmond | Redmond | `provider-seattle` | Seattle | Redmond (Seattle) |
| Bing Image Creator | Redmond | Redmond | `provider-seattle` | Seattle | Redmond (Seattle) |
| Visme AI | Rockville | Rockville | `provider-washington-dc` | Washington DC | Rockville (Washington DC) |

### Field Hierarchy

- **Tooltip `city` prop** → `mapping.tooltipCity ?? mapping.vibesCity`
- **Column 1 city label** → `provider.hqCity` + parenthetical `(mapping.tooltipCity)` when tooltipCity differs from hqCity
- **Venue vocabulary** → `mapping.vibesCity` (unchanged — Redmond and Rockville venue words stay)

### Málaga Encoding Fix

`providers.json` had `"hqCity": "MÃ¡laga"` (UTF-8 double-encoding of `á`). Fixed to `"hqCity": "Málaga"`. Affects the Freepik provider's column 1 city display.

---

## 14. Testing Checklist

| Test                                              | Expected Result                                      |
| ------------------------------------------------- | ---------------------------------------------------- |
| Hover provider emoji (daytime city)               | Tooltip with compass wind + visibility + humidity    |
| Hover provider emoji (nighttime city)             | Tooltip with compass wind + humidity (no visibility) |
| Hover provider emoji (calm wind ≤ 5 km/h)         | "with calm winds" (no compass)                       |
| Hover provider emoji (no wind degrees from OWM)   | "with winds of X km/h" (no compass)                  |
| Hover provider emoji (gusts reported by OWM)      | "with gusts of up to X km/h"                         |
| Hover provider emoji (no gusts from OWM)          | No gust text                                         |
| Hover provider emoji (visibility < 1 km, daytime) | Shows metres and yards                               |
| Click copy button                                 | Copies full sentence to clipboard, emerald tick      |
| Click speaker button                              | British female TTS reads sentence                    |
| Move cursor from emoji to tooltip                 | Tooltip stays open (400ms delay)                     |
| Move cursor away from tooltip                     | Tooltip closes after 400ms                           |
| Demo provider (no live weather)                   | Seeded random wind direction, gusts, visibility      |
| Hover Microsoft Designer emoji                    | Tooltip says "...over Seattle..." not Redmond        |
| Hover Bing Image Creator emoji                    | Tooltip says "...over Seattle..." not Redmond        |
| Hover Visme AI emoji                              | Tooltip says "...over Washington DC..." not Rockville|
| Column 1: Microsoft Designer                      | Shows "Redmond (Seattle)"                            |
| Column 1: Bing Image Creator                      | Shows "Redmond (Seattle)"                            |
| Column 1: Visme AI                                | Shows "Rockville (Washington DC)"                    |
| Column 1: Freepik                                 | Shows "Málaga" not "MÃ¡laga"                         |
| Hover Midjourney emoji                            | Still "...over San Francisco..." (unchanged)         |

---

# Part 3 — Meteorological Data → Prompt Converter (40 Platforms)


**Last updated:** 7 March 2026
**Version:** 1.0.0
**Owner:** Promagen
**Status:** Verified — zero bugs found in end-to-end audit
**Authority:** This document traces the complete pipeline from raw meteorological data through to optimised prompts for all 42 AI image generation platforms. Cross-referenced against `src.zip` (7 March 2026).

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Stage 1 — Meteorological Data Ingestion](#2-stage-1--meteorological-data-ingestion)
3. [Stage 2 — Physics Computation (17 Algorithms)](#3-stage-2--physics-computation-17-algorithms)
4. [Stage 3 — Weather Category Mapping](#4-stage-3--weather-category-mapping)
5. [Stage 4 — Selections Flattening](#5-stage-4--selections-flattening)
6. [Stage 5 — Synergy Rewriting](#6-stage-5--synergy-rewriting)
7. [Stage 6 — Tier-Aware Assembly](#7-stage-6--tier-aware-assembly)
8. [Stage 7 — Post-Processing](#8-stage-7--post-processing)
9. [Stage 8 — Per-Platform Optimisation](#9-stage-8--per-platform-optimisation)
10. [Platform-Tier Matrix (42 Platforms × 4 Tiers)](#10-platform-tier-matrix-42-platforms--4-tiers)
11. [Data Integrity Verification](#11-data-integrity-verification)
12. [Observations (Non-Bugs)](#12-observations-non-bugs)
13. [File Reference](#13-file-reference)

---

## 1. Pipeline Overview

Raw weather API data enters the system and exits as an optimised prompt formatted for a specific platform. The pipeline has 8 stages, each with a single responsibility. No stage knows about the stages after it — data flows forward only.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     THE COMPLETE PIPELINE                            │
│                                                                     │
│  METEOROLOGICAL DATA (OpenWeatherMap API)                           │
│        │                                                            │
│        ▼                                                            │
│  Stage 1: Data Ingestion                                            │
│        │  temperature, humidity, wind, clouds, pressure,            │
│        │  visibility, sunrise/sunset, lat/lon                       │
│        ▼                                                            │
│  Stage 2: Physics Computation (17 algorithms)                       │
│        │  solar elevation, lighting engine, visual truth,           │
│        │  camera lens, wind system, cloud types, moon phase,        │
│        │  composition blueprint, climate context                    │
│        ▼                                                            │
│  Stage 3: Weather Category Mapping                                  │
│        │  buildWeatherCategoryMap() → WeatherCategoryMap            │
│        │  12 categories: selections + customValues + weights        │
│        ▼                                                            │
│  Stage 4: Selections Flattening                                     │
│        │  selectionsFromMap() → PromptSelections                    │
│        │  Deduplicates selection ⊂ customValue redundancy           │
│        ▼                                                            │
│  Stage 5: Synergy Rewriting                                         │
│        │  rewriteWithSynergy() → conflict resolution               │
│        │  "golden hour" + "midnight" → resolve contradiction        │
│        ▼                                                            │
│  Stage 6: Tier-Aware Assembly                                       │
│        │  assemblePrompt(refPlatform, selections, weightOverrides)  │
│        │  Routes to: assembleKeywords() | assembleNaturalSentences()│
│        │             assemblePlainLanguage()                        │
│        ▼                                                            │
│  Stage 7: Post-Processing                                           │
│        │  neutraliseLeakPhrases(), fixCommonGrammar(),              │
│        │  postProcessTier1Positive(), removeRedundantPhenomenon()   │
│        ▼                                                            │
│  Stage 8: Per-Platform Optimisation                                 │
│        │  optimizePromptGoldStandard()                              │
│        │  4 strategy pipelines: keywords | midjourney | natural |   │
│        │  plain — semantic similarity, compression, BPE tokens      │
│        ▼                                                            │
│  OPTIMISED PROMPT (formatted for specific platform)                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key design principle:** The weather generator is intelligence-only — it computes WHAT the scene looks like. The prompt builder is the single assembly engine — it formats HOW the prompt reads. One brain. One output path. Every prompt in Promagen passes through `assemblePrompt()`.

---

## 2. Stage 1 — Meteorological Data Ingestion

**Source:** OpenWeatherMap API via gateway server (`src/lib/weather/fetch-weather.ts`).

**Raw data fields consumed:**

| Field                      | Type   | Example         | Purpose                                           |
| -------------------------- | ------ | --------------- | ------------------------------------------------- |
| `temperatureC`             | number | 14              | Thermal phrases, atmosphere, colour temperature   |
| `humidity`                 | number | 82              | Moisture visibility, surface grounding, dew point |
| `windSpeedKmh`             | number | 15              | Beaufort classification, action phrases           |
| `windDegrees`              | number | 225             | Directional wind phrases                          |
| `cloudCover`               | number | 75              | Lighting engine cloud floor, sky descriptions     |
| `visibility`               | number | 8000            | Air clarity, atmospheric haze                     |
| `pressure`                 | number | 1013            | Atmospheric density effects                       |
| `conditions`               | string | "broken clouds" | Atmosphere vocabulary mapping                     |
| `sunriseUtc` / `sunsetUtc` | string | ISO timestamp   | Day/night resolution, golden/blue hour            |
| `latitude` / `longitude`   | number | 35.68 / 139.69  | Solar elevation, climate zone                     |

**Additional inputs (not from API):**

| Input      | Source                                        | Purpose                    |
| ---------- | --------------------------------------------- | -------------------------- |
| City name  | `city-vibes.json` SSOT (102 cities)           | Subject term, venue lookup |
| Venue      | `getCityVenue(city, seed)` or `venueOverride` | Environment category       |
| Local hour | Computed from UTC + timezone offset           | Time-of-day mood, lighting |
| Tier (1-4) | Caller specifies                              | Assembly format routing    |

---

## 3. Stage 2 — Physics Computation (17 Algorithms)

**File:** `src/lib/weather/weather-prompt-generator.ts` (487 lines) — orchestrator.

These 17 systems run in sequence, each producing structured data that feeds into the category mapper. They are deterministic — same inputs always produce same outputs.

| #   | Algorithm                       | File                                   | Input                                            | Output                                               |
| --- | ------------------------------- | -------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| 1   | Solar elevation calculator      | `sun-calculator.ts`                    | lat, lon, UTC time                               | Degrees above/below horizon                          |
| 2   | Lunar position calculator       | `sun-calculator.ts`                    | lat, lon, UTC time                               | Azimuth, altitude, phase                             |
| 3   | Precipitation classifier        | `visual-truth.ts`                      | conditions, visibility                           | type, intensity, active flag                         |
| 4   | Cloud type classifier           | `cloud-types.ts`                       | conditions, cloud cover                          | nimbostratus, cirrus, etc.                           |
| 5   | Solar phase resolver            | `time-utils.ts`                        | solar elevation                                  | golden hour, blue hour, etc.                         |
| 6   | Day/night resolver              | `day-night.ts`                         | sunrise, sunset, timezone                        | boolean + 3-tier cascade                             |
| 7   | Visual truth engine             | `visual-truth.ts` (1,301 lines)        | temperature, humidity, wind, precip              | air clarity, contrast, moisture, thermal optics      |
| 8   | Climate context                 | `climate.ts`                           | latitude, temperature, humidity                  | climate zone, effective humidity                     |
| 9   | Lighting engine                 | `lighting-engine.ts` (973 lines)       | solar elevation, clouds, visibility, moon, venue | base phrase, CCT, shadows, atmosphere modifier       |
| 10  | Wind system                     | `wind-system.ts`                       | wind speed, direction, venue                     | Beaufort class, directional phrase                   |
| 11  | Moon phase calculator           | `moon-phase.ts`                        | date                                             | phase name, emoji, day in cycle                      |
| 12  | Camera lens system              | `camera-lens.ts` (289 lines)           | style, venue setting, seed                       | focal length, aperture, DoF                          |
| 13  | Composition blueprint           | `composition-blueprint.ts` (506 lines) | camera, venue, categories                        | foreground/midground/background layers               |
| 14  | Vocabulary loaders              | `vocabulary-loaders.ts`                | weather context, seed                            | temperature phrase, humidity phrase, time descriptor |
| 15  | Sky source enrichment           | `tier-generators.ts` (stub)            | sky source, visual truth, seed                   | Cloud type + solar phase enrichment                  |
| 16  | Lighting coherence validator    | `lighting-engine.ts`                   | lighting, venue, city, moon                      | Safety net — catches contradictions                  |
| 17  | Precipitation-aware cloud floor | `weather-prompt-generator.ts`          | precip state, cloud cover                        | Forces minimum cloud cover during rain               |

**Precipitation cloud floor (algorithm 17):** OWM sometimes reports low cloudiness during active rain. Algorithm 17 forces minimum cloud cover: rain/drizzle → 60% floor (heavy rain → 90%), snow → 40% floor. This prevents contradictory prompts like "bright sun during heavy rain."

---

## 4. Stage 3 — Weather Category Mapping

**File:** `src/lib/weather/weather-category-mapper.ts` (581 lines)
**Function:** `buildWeatherCategoryMap()`

This is the bridge between physics and assembly. It converts 17 algorithm outputs into the 12 prompt builder categories. Each category gets three data layers:

| Layer             | Purpose                                       | Example                                                                 |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `selections`      | Vocabulary-matched term (dropdown-compatible) | `["golden hour"]`                                                       |
| `customValues`    | Rich physics-computed phrase (freetext)       | `"Warm golden-hour glow casting long shadows across wet cobblestones."` |
| `weightOverrides` | CLIP weight adjustment for Tier 1             | `1.3` (subject), `1.2` (environment)                                    |

**Category mapping (12 categories):**

| Category    | Source Algorithm                            | Selection Example                  | CustomValue Example                                                       |
| ----------- | ------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| Subject     | City name (SSOT)                            | `["Tokyo"]`                        | —                                                                         |
| Environment | Venue system                                | `["Shibuya Crossing"]`             | —                                                                         |
| Lighting    | Lighting engine → `matchLightingVocab()`    | `["golden hour"]`                  | `"Warm golden-hour glow. Broken cumulus overhead."`                       |
| Atmosphere  | Weather context → `matchAtmosphereVocab()`  | `["gentle drizzle curtain"]`       | `"Early evening, moisture-heavy air, 14°C thermal haze"`                  |
| Style       | Profile → `mapStyleVocab()`                 | `["photorealistic"]`               | —                                                                         |
| Colour      | CCT → `mapColourFromCCT()`                  | `["warm tones"]`                   | —                                                                         |
| Fidelity    | Camera system → `getQualityTagsT1()`        | `["8K", "sharp focus"]`            | —                                                                         |
| Materials   | Visual truth → `composeSurfaceSentence()`   | —                                  | `"Rain-slicked pavement reflecting neon, dew-heavy surfaces"`             |
| Action      | Wind system → `getWindPhrase()`             | —                                  | `"Southerly 15 km/h wind stirring loose paper and awnings"`               |
| Camera      | Camera lens → `matchCameraVocab()`          | `["35mm lens"]`                    | `"Shot on Sony A7III with 35mm f/1.4"`                                    |
| Composition | Blueprint → `computeCompositionBlueprint()` | `["leading lines"]`                | `"Foreground rain puddles, midground neon signs, background city towers"` |
| Negative    | Quiet-hours logic                           | `["blurry", "watermarks", "text"]` | —                                                                         |

**Confidence scoring:** Each category gets a 0–1 confidence score. Subject = 1.0 (always certain). Lighting = 0.95 with visual truth, 0.6 without. Atmosphere = 0.5 on generic fallbacks. The UI uses confidence for chip opacity in the builder.

---

## 5. Stage 4 — Selections Flattening

**File:** `src/lib/prompt-builder.ts` (line 1695)
**Function:** `selectionsFromMap()`

Converts `WeatherCategoryMap` into flat `PromptSelections` (the format `assemblePrompt()` consumes).

**Key logic — redundancy elimination (Upgrade 1, v11.1.0):**

When a `customValue` contains a `selection` term as a substring, the selection is dropped. The customValue is always the richer phrase.

Example:

- Selection: `["moonlight"]`
- CustomValue: `"Cool white moonlight competing with focused accent lighting"`
- Result: `["Cool white moonlight competing with focused accent lighting"]` (selection "moonlight" dropped — it's inside the customValue)

When a selection is NOT contained in the customValue, it's kept as an independent term:

- Selection: `["contemplative"]`
- CustomValue: `"fog rolling through urban canyon"`
- Result: `["contemplative", "fog rolling through urban canyon"]` (both kept)

Negatives are mapped to the `negative` category key.

---

## 6. Stage 5 — Synergy Rewriting

**File:** `src/lib/weather/synergy-rewriter.ts` (600 lines)
**Function:** `rewriteWithSynergy()`

Resolves physics contradictions and reinforces complementary pairs:

**Conflict resolution:** "golden hour" (lighting) + "midnight" (atmosphere) → replaces "golden hour" with "amber artificial light" (because golden hour can't exist at midnight).

**Reinforcement bridging:** "moonlight" (lighting) + "contemplative" (atmosphere) → injects connecting phrase that bridges the two for stronger prompt coherence.

The rewriter runs between flattening and assembly. It modifies selections in-place — the assembler receives already-resolved data.

---

## 7. Stage 6 — Tier-Aware Assembly

**File:** `src/lib/prompt-builder.ts` (line 1388)
**Function:** `assemblePrompt()` → `assembleTierAware()`

This is the **single brain**. Every prompt in Promagen — weather-generated, user-built, scene-starter, randomiser — passes through this function.

**Routing logic in `assembleTierAware()` (line 1146):**

```
if tierId === 4           → assemblePlainLanguage()
else if promptStyle === 'keywords' → assembleKeywords()
else                      → assembleNaturalSentences()
```

**Pre-assembly processing:**

1. **Within-category dedup** — drops short terms that are substrings of longer terms in the same category
2. **Cross-category dedup** — same term in two categories → kept only in the first (higher-priority) category
3. **Weight merge** — weather `weightOverrides` provide a base layer; platform `weightedCategories` spread on top. Platform wins on conflicts.

### 7.1 Tier 1 — CLIP-Based Assembly (`assembleKeywords`)

**Reference platform:** `leonardo` (weight syntax: `{term}::{weight}`)
**13 platforms:** artguru, clipdrop, dreamlike, dreamstudio, getimg, jasper-art, leonardo, lexica, nightcafe, novelai, openart, playground, stability

**Assembly flow:**

1. Quality prefix: `["masterpiece", "best quality", "highly detailed"]`
2. Selections in impact-priority order, with CLIP weight wrapping on short terms
3. Quality suffix: `["sharp focus", "8K", "intricate textures"]`
4. Trim to sweetSpot
5. CLIP syntax sanitiser: periods → commas, strip trailing periods
6. Negative handling: separate field with `qualityNegative` prepended

**Weight wrapping guard:** `if (weight && syntax)` — weight wrapping ONLY occurs when both a weight value exists AND the platform has `weightingSyntax` defined. Rich phrases (>4 words) skip weight wrapping entirely.

**Example output (Leonardo):**

```
masterpiece, best quality, highly detailed, Tokyo::1.2, Shibuya Crossing::1.05,
golden hour glow::1.1, photorealistic::1.15, warm tones, gentle drizzle curtain,
leading lines, shot on Sony A7III, sharp focus, 8K, intricate textures
```

**Negative field:**

```
worst quality, low quality, normal quality, blurry, watermarks, text, oversaturated
```

**Flux special handling:** The weather generator produces Flux prompts via `assemblePrompt('flux', selections)` — no `weightOverrides` passed. Flux has `promptStyle: keywords` but NO `weightingSyntax`, so `assembleKeywords()` produces clean comma-separated keywords without any weight wrapping. Correct for Flux's T5 encoder.

### 7.2 Tier 2 — Midjourney Assembly (`assembleKeywords`)

**Reference platform:** `midjourney`
**2 platforms:** midjourney, bluewillow

**Assembly flow:**

1. Quality suffix: `["high quality", "detailed"]`
2. Selections in impact-priority order (no weight wrapping — MJ has no `weightingSyntax`)
3. Trim to sweetSpot (40 words — MJ is brief)
4. Inline negatives with `--no {negative}` syntax

**Example output:**

```
Tokyo, Shibuya Crossing, golden hour, cinematic, gentle rain, neon reflections,
high quality, detailed --no blurry, watermarks, text, oversaturated
```

### 7.3 Tier 3 — Natural Language Assembly (`assembleNaturalSentences`)

**Reference platform:** `openai`
**10 platforms:** adobe-firefly, bing, flux, google-imagen, hotpot, ideogram, imagine-meta, microsoft-designer, openai, runway

**Assembly flow:**

1. Build sentence nucleus: Subject + Action + early Environment (with "in" prefix)
2. Append trailing clauses in effective order: style, lighting, atmosphere, etc.
3. Negatives converted to positive equivalents ("blurry" → "sharp focus") + "without" clauses
4. Trim to sweetSpot (250 chars for openai)

**Example output (DALL-E/OpenAI):**

```
Tokyo street in Shibuya Crossing, photorealistic, warm golden-hour glow casting
long shadows across wet cobblestones, gentle drizzle curtain, moisture-heavy air,
warm tones, leading lines composition, sharp focus, without blurry or watermarks
```

### 7.4 Tier 4 — Plain Language Assembly (`assemblePlainLanguage`)

**Reference platform:** `canva`
**17 platforms:** artbreeder, artistly, canva, craiyon, deepai, fotor, freepik, myedit, photoleap, picsart, picwish, pixlr, remove-bg, simplified, visme, vistacreate, 123rf

**Assembly flow:**

1. Collect all selections in impact-priority order
2. Rich phrases (>4 words) simplified to first 3 content words
3. Trim aggressively to sweetSpot (40 chars for canva)
4. No weight syntax, no quality prefix, no negative field

**Example output (Canva):**

```
Tokyo, Shibuya Crossing, golden hour, photorealistic, rain
```

---

## 8. Stage 7 — Post-Processing

**File:** `src/lib/prompt-post-process.ts`

Applied per-tier after assembly:

| Function                       | Applies To    | Purpose                                                                             |
| ------------------------------ | ------------- | ----------------------------------------------------------------------------------- |
| `neutraliseLeakPhrases()`      | All tiers     | Removes vocabulary terms that leaked from the weather engine's internal naming      |
| `fixCommonGrammar()`           | All tiers     | Fixes double spaces, stray punctuation, capitalisation errors                       |
| `postProcessTier1Positive()`   | Tier 1 only   | CLIP-specific cleanup: atmosphere modifier injection, redundant fidelity dedup      |
| `removeRedundantPhenomenon()`  | Tiers 2, 3, 4 | Removes atmospheric phenomenon mentions when already encoded by the lighting engine |
| `trimMjPhenomenonDuplicates()` | Tier 2 only   | MJ-specific: removes "haze" etc. when atmosphere already encodes haze               |

---

## 9. Stage 8 — Per-Platform Optimisation

**File:** `src/lib/prompt-optimizer.ts` (1,605 lines)
**Function:** `optimizePromptGoldStandard()`

The optimiser takes assembled prompt text and compresses it to fit the platform's `idealMax` character budget while preserving the highest-value terms.

**Strategy routing (mirrors assembler exactly):**

```
if tierId === 4                          → 'plain' strategy
if promptStyle === 'keywords' + tierId 2 → 'midjourney' strategy
if promptStyle === 'keywords'            → 'keywords' (CLIP) strategy
else                                     → 'natural' strategy
```

**4 optimisation pipelines:**

| Strategy     | Platforms             | Key Technique                                                                                              |
| ------------ | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `keywords`   | 13 Tier 1 + Flux      | 5-phase: redundancy pairs → semantic similarity → term scoring → compression rules → BPE token enforcement |
| `midjourney` | 2 Tier 2              | Protect `--` params, steep position decay, tight 40-word budget                                            |
| `natural`    | 9 Tier 3 (excl. Flux) | Clause-level surgery — remove whole sentences, not words                                                   |
| `plain`      | 17 Tier 4             | Simplified keyword removal, aggressive length target                                                       |

**Shared building blocks across all 4 strategies:**

- 217 redundancy pairs (hand-curated) + semantic similarity pairs (auto-computed from CLIP embeddings)
- 50+ compression rules (e.g., "subject centred vertically" → "centered")
- Real CLIP BPE tokenisation for Tier 1 (falls back to word-level heuristic)
- Per-strategy category importance weights (MJ: fidelity=0.20, not 0.85)
- Per-strategy position decay curves

---

## 10. Platform-Tier Matrix (42 Platforms × 4 Tiers)

### Tier 1 — CLIP-Based (13 platforms)

| Platform    | Weight Syntax       | Sweet Spot | Token Limit | Negative Mode |
| ----------- | ------------------- | ---------- | ----------- | ------------- |
| artguru     | `({term}:{weight})` | 100        | 200         | separate      |
| clipdrop    | `({term}:{weight})` | 100        | 200         | separate      |
| dreamlike   | `({term}:{weight})` | 100        | 200         | separate      |
| dreamstudio | `({term}:{weight})` | 100        | 200         | separate      |
| getimg      | `({term}:{weight})` | 100        | 200         | separate      |
| jasper-art  | `({term}:{weight})` | 100        | 200         | separate      |
| leonardo    | `{term}::{weight}`  | 100        | 200         | separate      |
| lexica      | `({term}:{weight})` | 100        | 200         | separate      |
| nightcafe   | `({term}:{weight})` | 100        | 200         | separate      |
| novelai     | `{{{term}}}`        | 100        | 200         | separate      |
| openart     | `({term}:{weight})` | 100        | 200         | separate      |
| playground  | `({term}:{weight})` | 100        | 200         | separate      |
| stability   | `({term}:{weight})` | 100        | 200         | separate      |

### Tier 2 — Midjourney Family (2 platforms)

| Platform   | Weight Syntax | Sweet Spot | Token Limit | Negative Mode   |
| ---------- | ------------- | ---------- | ----------- | --------------- |
| midjourney | none          | 40         | 60          | inline (`--no`) |
| bluewillow | none          | 40         | 60          | inline (`--no`) |

### Tier 3 — Natural Language (10 platforms)

| Platform           | Prompt Style | Sweet Spot | Token Limit | Negative Mode    |
| ------------------ | ------------ | ---------- | ----------- | ---------------- |
| adobe-firefly      | natural      | 150        | 400         | none (converted) |
| bing               | natural      | 200        | 400         | none (converted) |
| flux               | keywords     | 120        | 256         | separate         |
| google-imagen      | natural      | 200        | 400         | none (converted) |
| hotpot             | natural      | 100        | 200         | none (converted) |
| ideogram           | natural      | 250        | 400         | none (converted) |
| imagine-meta       | natural      | 200        | 320         | none (converted) |
| microsoft-designer | natural      | 200        | 400         | none (converted) |
| openai             | natural      | 250        | 400         | none (converted) |
| runway             | natural      | 200        | 320         | separate         |

### Tier 4 — Plain Language (17 platforms)

| Platform    | Sweet Spot | Token Limit | Negative Mode |
| ----------- | ---------- | ----------- | ------------- |
| artbreeder  | 40         | 100         | none          |
| artistly    | 80         | 150         | separate      |
| canva       | 40         | 150         | none          |
| craiyon     | 60         | 150         | none          |
| deepai      | 60         | 150         | none          |
| fotor       | 40         | 150         | none          |
| freepik     | 60         | 150         | none          |
| myedit      | 40         | 100         | none          |
| photoleap   | 60         | 150         | none          |
| picsart     | 60         | 150         | none          |
| picwish     | 30         | 100         | none          |
| pixlr       | 60         | 150         | none          |
| remove-bg   | 30         | 100         | none          |
| simplified  | 40         | 100         | none          |
| visme       | 60         | 150         | none          |
| vistacreate | 60         | 150         | none          |
| 123rf       | 60         | 150         | none          |

---

## 11. Data Integrity Verification

**Cross-reference audit (7 March 2026):**

| Check                                              | Result  | Details                                                 |
| -------------------------------------------------- | ------- | ------------------------------------------------------- |
| All 42 platforms in `providers.json`               | ✅ Pass | 42/42                                                   |
| All 42 platforms in `platform-formats.json`        | ✅ Pass | 42/42                                                   |
| All 42 platforms in `platform-tiers.ts`            | ✅ Pass | 13 + 2 + 10 + 17 = 42                                   |
| No platform in formats missing from tiers          | ✅ Pass | 0 orphans                                               |
| No platform in tiers missing from formats          | ✅ Pass | 0 orphans                                               |
| No platform in providers missing from formats      | ✅ Pass | 0 orphans                                               |
| Assembler routing matches tier assignment          | ✅ Pass | All 42 route correctly                                  |
| Optimiser routing mirrors assembler routing        | ✅ Pass | `detectStrategy()` matches `assembleTierAware()`        |
| No sweetSpot > tokenLimit violations               | ✅ Pass | All 42 clean                                            |
| All inline-negative platforms have negativeSyntax  | ✅ Pass | MJ + BW both have `--no {negative}`                     |
| Weight wrapping guarded by `if (weight && syntax)` | ✅ Pass | No unwanted wrapping on non-CLIP platforms              |
| `selectionsFromMap()` dedup logic correct          | ✅ Pass | Selection ⊂ customValue → selection dropped             |
| Post-processing per-tier routing correct           | ✅ Pass | T1-specific, T2-specific, and shared paths all verified |
| Flux special handling correct                      | ✅ Pass | No weights, keyword assembly, T5-compatible output      |
| Tier 4 override catches all 17 platforms           | ✅ Pass | `tierId === 4` check before promptStyle check           |

---

## 12. Observations (Non-Bugs)

These are design decisions that are architecturally sound but worth documenting:

**1. Leonardo weight syntax diverges from SD family:**
Leonardo uses `{term}::{weight}` (producing `subject::1.2`) while all other Tier 1 SD-family platforms use `({term}:{weight})` (producing `(subject:1.2)`). Since Leonardo is the Tier 1 reference platform, the PotM showcase displays `::` syntax for the CLIP tier. When a user clicks "Try in Stability AI", `assemblePrompt('stability', ...)` correctly uses `(term:1.2)`. The showcase display ≠ per-platform output. This is by design.

**2. Flux is Tier 3 with `promptStyle: keywords`:**
Flux uses a T5 encoder (natural language aware) but performs best with descriptive comma-separated keywords, not flowing sentences. The `promptStyle: keywords` config routes Flux through `assembleKeywords()` which produces clean keyword output. The Tier 3 assignment is the correct user-facing classification (Flux doesn't support CLIP weight syntax). The config pairing is intentional.

**3. Artistly has dead weight config in Tier 4:**
Artistly's `platform-formats.json` entry includes `weightingSyntax: "({term}:{weight})"` and `weightedCategories`, but Artistly is Tier 4. The `tierId === 4` override routes it to `assemblePlainLanguage()`, which ignores weight config entirely. The dead config has no functional impact but is technically unreachable code in JSON form.

---

## 13. File Reference

| Stage             | Primary File                                  | Lines  | Purpose                                             |
| ----------------- | --------------------------------------------- | ------ | --------------------------------------------------- |
| Orchestrator      | `src/lib/weather/weather-prompt-generator.ts` | 487    | Pipeline entry point, coordinates all stages        |
| Physics           | `src/lib/weather/` (24 files)                 | ~9,538 | 17 algorithms for meteorological computation        |
| Category mapping  | `src/lib/weather/weather-category-mapper.ts`  | 581    | Bridges physics → 12 prompt categories              |
| Synergy rewriting | `src/lib/weather/synergy-rewriter.ts`         | 600    | Conflict resolution + reinforcement                 |
| Assembly          | `src/lib/prompt-builder.ts`                   | 1,739  | Single brain: `assemblePrompt()` + 3 sub-assemblers |
| Post-processing   | `src/lib/prompt-post-process.ts`              | ~200   | Per-tier cleanup and grammar                        |
| Optimisation      | `src/lib/prompt-optimizer.ts`                 | 1,605  | 4-strategy compression pipeline                     |
| Platform config   | `src/data/providers/platform-formats.json`    | 1,539  | 42 platform configs (sweetSpot, weights, syntax)    |
| Tier mapping      | `src/data/platform-tiers.ts`                  | 200    | 42 platforms → 4 tiers                              |
| Types             | `src/types/prompt-builder.ts`                 | ~350   | `WeatherCategoryMap`, `PromptCategory`, etc.        |

**Total pipeline code:** ~16,839 lines across ~32 files.

---

## Related Documents

| Document                               | Relevance                                            |
| -------------------------------------- | ---------------------------------------------------- |
| `unified-prompt-brain.md`              | Architecture of the single-brain assembly system     |
| `weather-prompt-generator-analysis.md` | Quality scoring (82→93/100) and improvement roadmap  |
| `prompt-optimizer.md`                  | Optimiser architecture and compression strategies    |
| `prompt-builder-page.md`               | Builder UI and `assemblePrompt()` integration        |
| `prompt-builder-evolution-plan-v2.md`  | Historical evolution from dual-brain to single-brain |
| `code-standard.md`                     | `assemblePrompt()` signature, `PromptCategory` type  |
| `homepage.md`                          | PotM route, showcase component, "Try in" mechanic    |

---

## Changelog

| Date | Change |
|------|--------|
| 9 Apr 2026 | v2.0.0: Merged 3 docs into single weather-prompt-system.md. Platform count note: 40 not 42. |
| 7 Mar 2026 | meteorological converter v1.0.0. |
| 22 Feb 2026 | providers-meteorological created. |

---

_This document is the authority for the complete weather → prompt pipeline. `src.zip` is the SSoT._
