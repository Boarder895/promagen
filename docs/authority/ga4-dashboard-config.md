# Promagen GA4 Dashboard Configuration

**Authority:** analytics-build-plan-v1.3-FINAL.md §5 Part 7  
**When:** After build is deployed and events are flowing  
**Verification:** GA4 Realtime report shows active user within 30 seconds of visiting site

---

## Step 1 — Mark Key Events as Conversions

Go to: **GA4 Admin → Data display → Events**

Toggle these events as **Conversions** (called "Key Events" in newer GA4):

| Event | Why it's a conversion |
|---|---|
| `provider_outbound` | User left Promagen to use a provider — bottom of funnel |
| `prompt_builder_open` | User entered the prompt builder — strong engagement signal |

Do NOT mark these as conversions (they're funnel steps, not endpoints):
- `provider_click` (browse intent, not conversion)
- `prompt_copy` (usage, but user hasn't left yet)
- `nav_click` (navigation, not conversion)

---

## Step 2 — Create Custom Dimensions

Go to: **GA4 Admin → Custom definitions → Custom dimensions**

Create these **event-scoped** custom dimensions:

| Dimension name | Event parameter | Scope | Purpose |
|---|---|---|---|
| Provider ID | `provider_id` | Event | Slice all events by provider |
| Provider Name | `provider_name` | Event | Human-readable provider label |
| Surface | `surface` | Event | Where the action happened (engine_bay, mobile_card, prompt_builder) |
| AI Source | `ai_source` | Event | Which AI system referred the user (Extra 1) |
| Landing Page | `landing_page` | Event | Where AI-referred users landed (Extra 1) |
| Attribution Chain | `attribution_chain` | Event | Weighted touchpoint attribution (Extra 3) |
| Primary Driver | `primary_driver` | Event | Highest-attribution touchpoint (Extra 3) |
| Prompt Quality Score | `prompt_quality_score` | Event | BQI score at conversion time (Extra 4) |
| Platform Tier at Copy | `platform_tier_at_copy` | Event | Which tier the user was on at conversion (Extra 4) |

Note: GA4 allows up to 50 event-scoped custom dimensions on the free tier.

---

## Step 3 — AI Referral Monitoring

No configuration needed — GA4 automatically tracks referral sources.

Monitor in: **Reports → Acquisition → Traffic Acquisition**

Watch for these referral domains appearing:
- `chatgpt.com` — ChatGPT citations
- `perplexity.ai` — Perplexity citations
- `claude.ai` — Claude citations
- `gemini.google.com` — Gemini citations

The `ai_citation_landing` event (Extra 1) gives you deeper data than GA4's default referral tracking, because it captures the exact landing page and UTM params.

---

## Step 4 — Build Key Reports

### Conversion Funnel (Explorations → Funnel)

Steps:
1. `provider_click` (Browse)
2. `prompt_builder_open` (Engage)
3. `prompt_copy` (Use)
4. `provider_outbound` (Convert)

Break down by: `surface`, `provider_id`

### AI Citation ROI (Explorations → Free Form)

Dimensions: `ai_source`, `landing_page`  
Metrics: `Event count`, `Conversions`  
Filter: Event name = `ai_citation_landing`

This answers: "Which AI systems cite us, and do their users convert?"

### Prompt Quality vs Conversion (Explorations → Free Form)

Dimensions: `prompt_quality_score`, `platform_tier_at_copy`  
Metrics: `Event count`  
Filter: Event name = `provider_outbound`

This answers: "Do higher-quality prompts lead to more conversions?"

---

## Step 5 — Verify Data is Flowing

1. Set `NEXT_PUBLIC_ANALYTICS_DEBUG=true` in `.env.local`
2. Open site in Chrome with no ad-blocker
3. Open DevTools Console — look for `[analytics:event]` logs
4. Open GA4 → Realtime → see your session appear
5. Click through the funnel: provider click → builder → copy → outbound
6. Check each event appears in Realtime with correct params

Once confirmed, set `NEXT_PUBLIC_ANALYTICS_DEBUG=false` for production.
