# Fallback Provider Module

> **GUARDRAIL G5**: Provider documentation must be in provider folder.

## Overview

The fallback module contains feeds that currently have **no external API provider**. These feeds return demo/fallback data until a provider is integrated.

## Architecture

```
fallback/
├── index.ts          # Public exports (GUARDRAIL G2)
├── scheduler.ts      # Clock-aligned scheduler (:10/:40)
├── commodities.ts    # Commodities feed handler
└── README.md         # This file (GUARDRAIL G5)
```

## Feeds

| Feed        | Provider | Status       | Slots    |
|-------------|----------|--------------|----------|
| Commodities | None     | Demo prices  | :10/:40  |

## Clock-Aligned Schedule

Even though there's no API, commodities uses clock-aligned scheduling for consistency:

```
Hour timeline:
:00  :05  :10  :20  :30  :35  :40  :50
 FX  IDX  CMD  CRY  FX  IDX  CMD  CRY
 TD   MS   --   TD   TD   MS   --   TD

TD = TwelveData
MS = Marketstack
-- = No provider (fallback)
```

**Why clock-align when there's no API?**

1. **Consistency**: All feeds use the same pattern
2. **Future-proof**: Ready to plug in a provider with ~50 lines of adapter code
3. **Predictable**: Cache refresh is deterministic
4. **Diagnostics**: `/trace` endpoint shows unified timing across all feeds

## Commodities Feed

### Data Model

Commodities follow a **2-3-2 split**:
- 2 Energy (Brent Crude, TTF Natural Gas)
- 3 Agriculture (Coffee, Sugar, Orange Juice)
- 2 Metals (Gold, Iron Ore)

### Demo Prices

| Commodity       | Symbol   | Demo Price | Currency |
|-----------------|----------|------------|----------|
| Brent Crude     | BRENT    | 78.50      | USD      |
| TTF Natural Gas | TTF_GAS  | 42.30      | EUR      |
| Coffee          | COFFEE   | 312.50     | USD      |
| Sugar           | SUGAR    | 21.45      | USD      |
| Orange Juice    | OJUICE   | 485.20     | USD      |
| Gold            | GOLD     | 2650.00    | USD      |
| Iron Ore        | IRONORE  | 108.75     | USD      |

### Selection Rules (Pro Users)

Pro users can customize their commodities selection with these constraints:

1. **Exactly 7 commodities** required
2. **2-3-2 split** must be maintained:
   - 2 from Energy
   - 3 from Agriculture
   - 2 from Metals
3. All IDs must exist in catalog

## Adding a Provider

When a commodities provider is found, integration requires:

1. **Create adapter.ts** (~50 lines):
   ```typescript
   export async function fetchCommodityPrices(
     symbols: string[],
     apiKey: string
   ): Promise<CommodityApiResponse> {
     // Implement provider-specific API call
   }
   ```

2. **Create budget.ts** (copy from marketstack):
   ```typescript
   // Set appropriate daily/minute limits
   const COMMODITIES_DAILY_LIMIT = 250;
   const COMMODITIES_MINUTE_LIMIT = 3;
   ```

3. **Update commodities.ts**:
   - Change `provider: 'none'` to `provider: 'newprovider'`
   - Implement `fetchQuotes()` using adapter
   - Implement `parseQuotes()` for response format

4. **Update scheduler slots** if needed (currently :10/:40)

## Security Checklist

- [x] No API key storage (no provider)
- [x] Input validation for Pro selection
- [x] ID length limits (max 64 chars)
- [x] Array size limits (max 50 items)
- [x] Deduplication and normalization
- [x] Group distribution enforcement

## Usage

### GET /commodities

Returns default 7 commodities with demo prices:

```json
{
  "meta": {
    "mode": "fallback",
    "provider": "none",
    "source": "fallback"
  },
  "data": [
    {
      "id": "brent_crude",
      "symbol": "BRENT",
      "name": "Brent Crude",
      "price": 78.50,
      "quoteCurrency": "USD"
    }
  ]
}
```

### POST /commodities (Pro users)

Custom selection with 2-3-2 split:

```json
{
  "commodityIds": [
    "brent_crude", "ttf_natural_gas",
    "coffee", "sugar", "orange_juice",
    "gold", "iron_ore"
  ],
  "tier": "paid"
}
```

## Imports

```typescript
// From server.ts (GUARDRAIL G2)
import { 
  commoditiesHandler, 
  validateCommoditiesSelection 
} from './fallback/index.js';
```
