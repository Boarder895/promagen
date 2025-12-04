# API quota planning – FMP + OilPriceAPI

This file is **design-time maths**, not runtime config.

It explains how Promagen turns provider quotas into:

- `default_update.cadence` per role
- a rough daily call budget per provider
- clear decisions on which endpoints are **auto-scheduled** vs **manual-only**

Assumptions:

- FMP free tier: **250 calls/day** → `safe_calls_per_day = floor(250 * 0.7) = 175`
- OilPriceAPI free tier: **500 calls/month**
  - Approx daily cap: `floor(500 / 31) = 16`
  - `safe_calls_per_day = floor(16 * 0.7) = 11`
- We treat an **“active day”** as **16 hours** of real usage for quota maths.

Formula:

```text
refreshes_per_day = (active_hours_per_day * 3600) / cadence_seconds
worst_case_calls_per_day = calls_per_refresh * refreshes_per_day
share_of_safe = worst_case_calls_per_day / safe_calls_per_day
```
