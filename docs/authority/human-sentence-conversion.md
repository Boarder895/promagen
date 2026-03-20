# Human Sentence Conversion

**Version:** 1.0.0  
**Date:** 20 March 2026  
**Status:** Design approved — not yet built  
**Owner:** Martin Farrell (solo founder)  
**Authority:** This document defines the architecture for converting natural English text into structured, platform-specific AI image prompts via the existing Prompt Intelligence pipeline.

**Cross-references:**

- `prompt-intelligence.md` — Intelligence engine architecture (17 algorithmic systems)
- `unified-prompt-brain.md` — One Brain / `assemblePrompt()` single assembly path
- `optimal-prompt-stacking.md` — Per-platform, per-category limits (45 platforms × 12 categories)
- `budget-aware-conversion-build-plan.md` — Dynamic budget-aware conversion system
- `paid_tier.md` — Pro Promagen feature gates

---

## 1. Problem Statement

Users think in sentences. AI image platforms think in structured categories with platform-specific syntax.

Today, a user must manually break their creative vision into 12 dropdown selections. This works for users who understand prompt engineering. It fails for users who think like this:

> "A beautiful mermaid is swimming gracefully in the open sea, surrounded by clear blue water and colourful tropical fish that move gently around her in every direction. Sunlight pours down through the surface of the water, casting soft shimmering rays all around her and making the whole underwater world look bright, peaceful, and magical."

That sentence contains subject, action, environment, lighting, atmosphere, colour, and materials — but the user shouldn't need to know that. They should paste it in and let the engine do the thinking.

### The quality case

The real problem isn't convenience — it's **image quality**. When a user pastes that sentence raw into Leonardo (CLIP, 75 tokens), everything after token 75 is silently truncated. Half their description vanishes. When they paste it into Midjourney, 70 of the 95 words are wasted — MJ ignores everything past word ~30. When they paste it into Artistly (Plain Language tier), the long paragraph overwhelms a tool designed for 18-word inputs.

The Intelligence Engine already solves all of this — but only if the input arrives as structured category selections. This feature bridges the gap.

---

## 2. Architecture

### The One Brain Rule

**The API call parses. The engine optimises. These are two different jobs. Never merge them.**

A single LLM API call categorises the human sentence into 12 structured categories. From that point forward, the existing `assemblePrompt()` pipeline handles everything: per-platform formatting, encoder-aware assembly, weight syntax, fidelity conversion, negative routing, budget-aware trim, the full 17-system intelligence layer.

If the API call also attempted to optimise or reformat the prompt, that would create a parallel assembly path — two things assembling prompts that can disagree. This violates the One Brain architecture. The API's only job is parsing.

### Data flow

```
┌─────────────────────────────────────────────────────────────────┐
│  HUMAN SENTENCE CONVERSION                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐                                          │
│   │ User pastes      │                                          │
│   │ natural English   │                                          │
│   │ sentence          │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐                                          │
│   │ ONE API CALL     │ ← LLM (Claude API)                      │
│   │ Parse only       │                                          │
│   │ "Categorise into │                                          │
│   │  12 categories"  │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐                                          │
│   │ Structured JSON   │                                          │
│   │ {                 │                                          │
│   │   subject: "...", │                                          │
│   │   action: "...",  │                                          │
│   │   style: "...",   │                                          │
│   │   ...             │                                          │
│   │ }                 │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐                                          │
│   │ DROPDOWN          │                                          │
│   │ POPULATION        │                                          │
│   │                   │                                          │
│   │ Known term?       │                                          │
│   │ → Select it       │                                          │
│   │                   │                                          │
│   │ Unknown term?     │                                          │
│   │ → Custom entry    │                                          │
│   │   field           │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────────────────────────────────────┐          │
│   │ EXISTING PIPELINE (unchanged)                     │          │
│   │                                                   │          │
│   │ assemblePrompt() → One Brain                      │          │
│   │ ├── Encoder detection (CLIP/T5/MJ/ChatGLM3/Prop) │          │
│   │ ├── Per-platform limits (540 unique values)       │          │
│   │ ├── Budget calculation                            │          │
│   │ ├── Weight syntax (platform-specific)             │          │
│   │ ├── Fidelity conversion                           │          │
│   │ ├── Negative routing                              │          │
│   │ ├── Smart trim (lowest-relevance first)           │          │
│   │ ├── Cross-source dedup                            │          │
│   │ ├── 56-rule compression engine                    │          │
│   │ └── Platform-specific output                      │          │
│   │                                                   │          │
│   │ Output: optimised, platform-specific prompt       │          │
│   └──────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. The API Call

### Purpose

One call. Parse only. No optimisation. No reformatting. No prompt assembly.

### Provider

Claude API (Anthropic). Chosen for structured output reliability, JSON mode, and cost efficiency. Can be swapped for any provider that returns reliable structured JSON.

### System prompt

```
You are a prompt categorisation engine for AI image generation.

Given a natural English description of an image, extract terms into exactly these 12 categories. Return ONLY valid JSON with no preamble, no markdown, no explanation.

Categories:
- subject: The main subject(s) of the image (people, animals, objects)
- action: What the subject is doing
- style: Artistic style (e.g., cinematic, watercolour, anime, photorealistic)
- environment: The setting or location
- composition: Framing and layout (e.g., close-up, wide shot, rule of thirds)
- camera: Lens and camera specifics (e.g., 35mm, telephoto, shallow depth of field)
- lighting: Light source and quality (e.g., golden hour, neon, candlelight)
- colour: Dominant colours or colour palette
- atmosphere: Mood and atmospheric conditions (e.g., misty, peaceful, dramatic)
- materials: Textures and surface qualities (e.g., glass, marble, wet concrete)
- fidelity: Quality descriptors (e.g., highly detailed, 8K, masterpiece)
- negative: Things to exclude from the image

Rules:
1. Extract only what is explicitly described or strongly implied. Do not invent.
2. Use short phrases (1-4 words per term), not full sentences.
3. A category may have multiple terms — return as an array.
4. If a category has no relevant content, return an empty array.
5. Do not include fidelity or negative terms unless the user explicitly mentions quality or exclusions.
6. Preserve the user's creative intent — do not reinterpret or "improve" their words.

Return format:
{
  "subject": ["term", ...],
  "action": ["term", ...],
  "style": ["term", ...],
  "environment": ["term", ...],
  "composition": ["term", ...],
  "camera": ["term", ...],
  "lighting": ["term", ...],
  "colour": ["term", ...],
  "atmosphere": ["term", ...],
  "materials": ["term", ...],
  "fidelity": ["term", ...],
  "negative": ["term", ...]
}
```

### User message

The raw human sentence, unmodified.

### Expected response

For the mermaid example:

```json
{
  "subject": ["beautiful mermaid", "colourful tropical fish"],
  "action": ["swimming gracefully"],
  "style": [],
  "environment": ["open sea", "tropical ocean"],
  "composition": [],
  "camera": [],
  "lighting": ["sunlight shimmering rays", "soft caustic light"],
  "colour": ["clear blue", "turquoise"],
  "atmosphere": ["peaceful", "magical", "dreamlike"],
  "materials": ["crystal-clear water"],
  "fidelity": [],
  "negative": []
}
```

### Cost estimate

Claude Sonnet: ~500 input tokens + ~150 output tokens per call ≈ $0.002 per conversion. At 1,000 conversions/month = $2/month. At 10,000 = $20/month. Well within Pro subscription revenue.

---

## 4. Dropdown Population

Once the API returns structured JSON, the builder populates itself.

### Term matching logic

For each category in the response:

1. **Exact match** — If the returned term exactly matches an existing vocabulary term (case-insensitive), select it in the dropdown.
2. **Fuzzy match** — If a close match exists (e.g., "golden hour lighting" → "golden hour"), select the closest match. Threshold: Levenshtein distance ≤ 3 or substring containment.
3. **No match** — If the term is genuinely new, place it in the **custom entry field** for that category. Custom entries are already supported in the builder, are protected by `assemblePrompt()`, and are never trimmed by smart trim (user intent is sacred — Prompt Intelligence core principle #1).

### Multiple terms per category

The API may return multiple terms per category (e.g., `subject: ["beautiful mermaid", "colourful tropical fish"]`). These are populated up to the platform's per-category limit:

- Free tier: per-platform free limits from `PLATFORM_SPECIFIC_LIMITS`
- Pro tier: per-platform pro limits from `PLATFORM_SPECIFIC_LIMITS`

If the API returns more terms than the limit allows, excess terms are placed in the custom entry field as comma-separated values. The assembler handles the rest.

### New vocabulary handling

Unknown terms that appear frequently across multiple users are candidates for the vocabulary library. These are **not** auto-added. Instead:

- Queue to Phase 7.7 Vocabulary Crowdsourcing pipeline (already built: 3-layer dedup, smart category suggestion, admin review with batch workflow)
- Admin reviews and approves/rejects via the existing Admin Command Centre
- Approved terms become available in dropdowns for all users

This prevents junk from polluting the vocabulary over time.

---

## 5. User Experience

### Input surface

A text input area in the prompt builder — either:

**Option A:** Dedicated "Paste your description" textarea above the 12 dropdowns. User pastes, clicks "Parse", dropdowns populate. Clear separation between sentence input and structured input.

**Option B:** The existing assembled prompt output area doubles as input. User pastes into it, system detects it's a sentence (not structured output), triggers the parse. More seamless but potentially confusing.

**Option C:** A modal/drawer that opens from a "Write naturally" button. User types or pastes, clicks "Convert", modal closes, dropdowns are populated. Clean entry point, no UI clutter in the existing builder.

**Decision: TBD** — requires Martin's approval on which surface feels right.

### Loading state

The API call takes ~1-2 seconds. During this time:

- Show a progress indicator (assembly line animation from the Pro page concept — repurposed)
- Dropdowns remain interactive but show a subtle loading state
- User can cancel at any time

### Post-population

After dropdowns populate:

- User can modify any selection (the parse is a starting point, not a lock)
- User can add/remove terms from any category
- The assembled prompt updates live as selections change
- The user retains full control — the API suggests, the user decides

---

## 6. Pro Gate

### Tier access

| Tier                           | Access        |
| ------------------------------ | ------------- |
| Anonymous (3 prompts/day)      | Not available |
| Signed-in free (5 prompts/day) | Not available |
| Pro (unlimited)                | Full access   |

### Rationale

This feature has a per-use API cost (~$0.002). It's also the strongest conversion driver — a free user sees the "Write naturally" button, tries to click it, sees the Pro gate. The value proposition is instantly clear: "I can just type what I want and Promagen figures out the rest."

### Free tier teaser

Free users see the button but it's gated. On click, show a tooltip or modal: "Write like a human, generate like a pro. Upgrade to Pro Promagen to unlock natural language conversion."

---

## 7. Error Handling

### API failure

If the LLM API call fails (timeout, rate limit, malformed response):

- Show a clear error message: "Couldn't parse your description. Try again or use the dropdowns manually."
- Do not populate dropdowns with partial/broken data
- Log the failure for monitoring
- User can retry or fall back to manual dropdown selection

### Malformed response

If the API returns valid JSON but with unexpected structure:

- Validate against a Zod schema (same pattern as all other Promagen data)
- Skip any categories that don't match the expected format
- Populate what's valid, ignore what's not
- No silent failures — if categories are skipped, note it subtly

### Empty categories

If the API returns empty arrays for most categories (e.g., user typed something very abstract like "a feeling of nostalgia"):

- Populate what's available (maybe just `atmosphere: ["nostalgic"]`)
- Leave other dropdowns untouched
- User fills in the rest manually — the parse is a head start, not a complete solution

---

## 8. Security & Cost Control

### Rate limiting

- Per-user rate limit: 20 conversions per hour (Pro only)
- Global rate limit: 1,000 conversions per hour (across all users)
- Rate limit response: "You've reached the conversion limit. Please wait or use the dropdowns directly."

### Input sanitisation

- Strip HTML/script tags before sending to API
- Maximum input length: 1,000 characters (~200 words, blocks abuse)
- Reject empty or whitespace-only input

### Prompt injection protection

- The system prompt is hardcoded server-side, never exposed to the client
- The user's text is sent as the user message only
- The API response is validated against a strict Zod schema — any unexpected fields are rejected
- The parsed terms go through the same vocabulary pipeline as manual selections — no special code paths

### Cost monitoring

- Track API spend per user per month
- Dashboard in Admin Command Centre (Phase 7.11) for conversion volume and cost
- Alert threshold: if monthly API spend exceeds £50, notify admin

---

## 9. Implementation Plan

### Prerequisites

- Claude API key provisioned (server-side, never exposed to client)
- API route: `POST /api/parse-sentence`
- Zod schema for response validation

### Build order

| Part | Description                                                                         | Effort  | Dependencies               |
| ---- | ----------------------------------------------------------------------------------- | ------- | -------------------------- |
| 1    | API route (`/api/parse-sentence`) with system prompt, Zod validation, rate limiting | 1 day   | Claude API key             |
| 2    | Term matching logic (exact → fuzzy → custom entry)                                  | 1 day   | Existing vocabulary data   |
| 3    | Dropdown population wiring (hook that calls API, populates builder state)           | 1 day   | Parts 1-2                  |
| 4    | UI surface (input area / button / loading state) — choice of Option A/B/C           | 1 day   | Part 3 + Martin's approval |
| 5    | Pro gate (tier check, free user teaser)                                             | 0.5 day | Part 4                     |
| 6    | Admin dashboard integration (conversion volume, cost tracking)                      | 0.5 day | Part 1                     |
| 7    | Tests (API route, term matching, dropdown population, error handling)               | 1 day   | Parts 1-5                  |

**Total estimate: 6 days**

### What already exists (no build needed)

- `assemblePrompt()` — consumes structured selections, produces platform-specific prompts
- Custom entry fields per category — already in both builders
- Per-platform limits (`PLATFORM_SPECIFIC_LIMITS`) — already enforced
- Vocabulary Crowdsourcing pipeline (Phase 7.7) — already built for unknown terms
- Admin Command Centre (Phase 7.11) — already has dashboard infrastructure
- Pro tier gate infrastructure (Clerk auth + `usePromagenAuth` hook)

---

## 10. Future Extensions (Not In Scope — Document Only)

### 10.1 Batch conversion

User uploads multiple sentences (e.g., a brief document). Each sentence is parsed and saved as a separate prompt in the Saved Prompts library. Useful for professional workflows.

### 10.2 Conversation mode

Instead of a single parse, a back-and-forth: "Make it more dramatic" → API adjusts categories → dropdowns update. Requires conversation history management.

### 10.3 Image-to-sentence-to-prompt

User uploads a reference image → vision API describes it in natural English → sentence conversion parses it → dropdowns populate. Full circle from image to structured prompt.

### 10.4 Learning from corrections

When a user modifies the parsed selections (e.g., moves "golden hour" from atmosphere to lighting), that correction feeds back into the system prompt tuning. Over time, the parse accuracy improves.

---

## Changelog

| Date        | Version | Change                                                                                                                                   |
| ----------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 20 Mar 2026 | 1.0.0   | Initial document. Architecture, API spec, data flow, dropdown population logic, Pro gate, error handling, security, implementation plan. |
