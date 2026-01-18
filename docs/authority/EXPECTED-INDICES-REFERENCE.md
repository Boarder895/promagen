# Expected Marketstack V2 Indices (86 Total)

> **Status:** ✅ Integration LIVE (Jan 14, 2026)  
> **Location:** `docs/authority/EXPECTED-INDICES-REFERENCE.md`

Based on API documentation samples and standard global index naming conventions.

---

## Current Live Status

| Component | Status | Notes |
|-----------|--------|-------|
| Gateway endpoint | ✅ LIVE | `https://promagen-api.fly.dev/indices` |
| Marketstack API | ✅ Connected | 250 credits/day budget |
| Benchmark mapping | ✅ Fixed | Aliases added for djia, tsx, russell_2000 |
| Exchange cards | ✅ Displaying | Real prices with change indicators |

---

## CRITICAL: Benchmark Alias Fixes (Jan 14, 2026)

The frontend catalog uses different benchmark keys than the gateway originally mapped. These **aliases** were added to `gateway/src/marketstack/adapter.ts`:

```typescript
export const BENCHMARK_TO_MARKETSTACK: Record<string, string> = {
  // Major US Indices
  sp500: 'GSPC.INDX',
  dow_jones: 'DJI.INDX',
  djia: 'DJI.INDX',           // ← ALIAS: Catalog uses 'djia', maps to dow_jones
  nasdaq_composite: 'IXIC.INDX',
  russell_2000: 'RUT.INDX',   // ← NEW: Russell 2000 Small Cap
  
  // Canada
  tsx_composite: 'GSPTSE.INDX',
  tsx: 'GSPTSE.INDX',         // ← ALIAS: Catalog uses 'tsx', maps to tsx_composite
  
  // ... other mappings unchanged
};
```

**Why this matters:**
- `exchanges.selected.json` uses `cboe-chicago` with benchmark `djia`
- Gateway had only `dow_jones` mapped
- Without alias, exchange card showed "···" instead of price
- Same issue for `tsx-toronto` (uses `tsx`) and `nasdaq-san-francisco` (uses `russell_2000`)

---

## Confirmed Working in Promagen (48 Exchanges)

All 48 exchanges in `exchanges.catalog.json` have been mapped with `marketstack.benchmark` keys:

| Exchange ID | Benchmark Key | Display Name | Region |
|-------------|---------------|--------------|--------|
| `adx-abu-dhabi` | `adx_general` | ADX General Index | UAE |
| `ase-amman` | `ase` | ASE General Index | Jordan |
| `asx-sydney` | `asx200` | S&P/ASX 200 | Australia |
| `athex-athens` | `athex` | ATHEX Composite | Greece |
| `b3-sao-paulo` | `ibovespa` | Ibovespa | Brazil |
| `bcba-buenos-aires` | `merval` | MERVAL | Argentina |
| `bist-istanbul` | `bist_100` | BIST 100 | Turkey |
| `bme-madrid` | `ibex_35` | IBEX 35 | Spain |
| `borsa-italiana-milan` | `ftse_mib` | FTSE MIB | Italy |
| `bse-mumbai` | `sensex` | S&P BSE Sensex | India |
| `bursa-malaysia-kuala-lumpur` | `klci` | FTSE Bursa Malaysia KLCI | Malaysia |
| `bvb-bucharest` | `bet` | BET Index | Romania |
| `bvl-lima` | `igbvl` | S&P/BVL Peru General | Peru |
| `cboe-chicago` | `djia` ⚠️ | Dow Jones Industrial Average | USA |
| `cse-colombo` | `aspi` | ASPI | Sri Lanka |
| `dfm-dubai` | `dfm_general` | DFM General Index | UAE |
| `egx-cairo` | `egx_30` | EGX 30 | Egypt |
| `euronext-amsterdam` | `aex` | AEX | Netherlands |
| `euronext-brussels` | `bel20` | BEL 20 | Belgium |
| `euronext-lisbon` | `psi20` | PSI 20 | Portugal |
| `euronext-paris` | `cac_40` | CAC 40 | France |
| `hkex-hong-kong` | `hang_seng` | Hang Seng | Hong Kong |
| `idx-jakarta` | `jci` | Jakarta Composite | Indonesia |
| `jse-johannesburg` | `jse_all_share` | JSE All Share | South Africa |
| `krx-seoul` | `kospi` | KOSPI | South Korea |
| `lse-london` | `ftse_100` | FTSE 100 | UK |
| `moex-moscow` | `moex` | MOEX Russia | Russia |
| `nasdaq-san-francisco` | `russell_2000` ⚠️ | Russell 2000 | USA |
| `nse-mumbai` | `nifty_50` | Nifty 50 | India |
| `nzx-wellington` | `nzx_50` | NZX 50 | New Zealand |
| `omx-copenhagen` | `omx_copenhagen_20` | OMX Copenhagen 20 | Denmark |
| `omx-helsinki` | `omx_helsinki_25` | OMX Helsinki 25 | Finland |
| `omx-stockholm` | `omx_stockholm_30` | OMX Stockholm 30 | Sweden |
| `oslo-bors` | `osebx` | Oslo Børs | Norway |
| `pse-manila` | `psei` | PSEi | Philippines |
| `qse-doha` | `qe_general` | QE General | Qatar |
| `set-bangkok` | `set` | SET Index | Thailand |
| `sgx-singapore` | `sti` | Straits Times Index | Singapore |
| `six-zurich` | `smi` | Swiss Market Index | Switzerland |
| `sse-santiago` | `ipsa` | S&P/CLX IPSA | Chile |
| `sse-shanghai` | `sse_composite` | SSE Composite | China |
| `szse-shenzhen` | `szse_component` | SZSE Component | China |
| `tadawul-riyadh` | `tasi` | Tadawul All Share | Saudi Arabia |
| `tase-tel-aviv` | `ta_35` | TA-35 | Israel |
| `tse-tokyo` | `nikkei_225` | Nikkei 225 | Japan |
| `tsx-toronto` | `tsx` ⚠️ | S&P/TSX Composite | Canada |
| `twse-taipei` | `taiex` | TAIEX | Taiwan |
| `vse-vienna` | `atx` | ATX | Austria |
| `xetra-frankfurt` | `dax` | DAX | Germany |
| `gpw-warsaw` | `wig20` | WIG20 | Poland |

⚠️ = Required alias in gateway adapter (catalog uses different key than original mapping)

---

## 16 Default Selected Exchanges

These are the exchanges in `exchanges.selected.json` that display on the homepage:

| Exchange ID | Benchmark | Index Name | Status |
|-------------|-----------|------------|--------|
| `nzx-wellington` | `nzx_50` | S&P/NZX 50 | ✅ |
| `asx-sydney` | `asx200` | S&P/ASX 200 | ✅ |
| `tse-tokyo` | `nikkei_225` | Nikkei 225 | ✅ |
| `hkex-hong-kong` | `hang_seng` | Hang Seng | ✅ |
| `set-bangkok` | `set` | SET Index | ✅ |
| `nse-mumbai` | `nifty_50` | Nifty 50 | ✅ |
| `dfm-dubai` | `dfm_general` | DFM General | ✅ |
| `bist-istanbul` | `bist_100` | BIST 100 | ✅ |
| `jse-johannesburg` | `jse_all_share` | JSE All Share | ✅ |
| `lse-london` | `ftse_100` | FTSE 100 | ✅ |
| `b3-sao-paulo` | `ibovespa` | Ibovespa | ✅ |
| `bcba-buenos-aires` | `merval` | MERVAL | ✅ |
| `sse-santiago` | `ipsa` | S&P IPSA | ✅ |
| `cboe-chicago` | `djia` | Dow Jones | ✅ (alias) |
| `tsx-toronto` | `tsx` | S&P/TSX | ✅ (alias) |
| `nasdaq-san-francisco` | `russell_2000` | Russell 2000 | ✅ (new) |

---

## Gateway Benchmark Mapping (Complete)

Located in `gateway/src/marketstack/adapter.ts`:

```typescript
export const BENCHMARK_TO_MARKETSTACK: Record<string, string> = {
  // Major US Indices
  sp500: 'GSPC.INDX',
  dow_jones: 'DJI.INDX',
  djia: 'DJI.INDX',                    // Alias for dow_jones
  nasdaq_composite: 'IXIC.INDX',
  russell_2000: 'RUT.INDX',            // Russell 2000 Small Cap
  
  // Europe
  ftse_100: 'FTSE.INDX',
  dax: 'GDAXI.INDX',
  cac_40: 'FCHI.INDX',
  ibex_35: 'IBEX.INDX',
  ftse_mib: 'FTSEMIB.INDX',
  aex: 'AEX.INDX',
  bel20: 'BFX.INDX',
  smi: 'SSMI.INDX',
  atx: 'ATX.INDX',
  omx_stockholm_30: 'OMXS30.INDX',
  omx_copenhagen_20: 'OMXC20.INDX',
  omx_helsinki_25: 'OMXH25.INDX',
  osebx: 'OSEBX.INDX',
  psi20: 'PSI20.INDX',
  athex: 'GD.INDX',
  bet: 'BETI.INDX',
  wig20: 'WIG20.INDX',
  moex: 'IMOEX.INDX',
  bist_100: 'XU100.INDX',
  
  // Asia-Pacific
  nikkei_225: 'N225.INDX',
  hang_seng: 'HSI.INDX',
  sse_composite: 'SSEC.INDX',
  szse_component: 'SZSC.INDX',
  kospi: 'KS11.INDX',
  taiex: 'TWII.INDX',
  asx200: 'AXJO.INDX',
  nzx_50: 'NZ50.INDX',
  nifty_50: 'NSEI.INDX',
  sensex: 'BSESN.INDX',
  sti: 'STI.INDX',
  klci: 'KLSE.INDX',
  jci: 'JKSE.INDX',
  set: 'SETI.INDX',
  psei: 'PSEI.INDX',
  aspi: 'CSE.INDX',
  
  // Middle East & Africa
  tasi: 'TASI.INDX',
  adx_general: 'ADI.INDX',
  dfm_general: 'DFMGI.INDX',
  qe_general: 'QSI.INDX',
  egx_30: 'EGX30.INDX',
  ta_35: 'TA35.INDX',
  jse_all_share: 'JALSH.INDX',
  ase: 'AMGNRLX.INDX',
  
  // Americas
  tsx_composite: 'GSPTSE.INDX',
  tsx: 'GSPTSE.INDX',                  // Alias for tsx_composite
  ibovespa: 'BVSP.INDX',
  merval: 'MERV.INDX',
  ipsa: 'IPSA.INDX',
  igbvl: 'SPBLPGPT.INDX',
};
```

---

## API Response Format

```json
{
  "benchmark": "nikkei_225",
  "region": "japan",
  "country": "japan",
  "price": "38945.72",
  "price_change_day": "312.45",
  "percentage_day": "0.81%",
  "percentage_week": "2.06%",
  "percentage_month": "1.13%",
  "percentage_year": "18.54%",
  "date": "2026-01-13"
}
```

**Field Mapping:**

| Marketstack | Gateway IndexQuote | Notes |
|-------------|-------------------|-------|
| `benchmark` | (lookup key) | Maps to exchange ID via catalog |
| `price` | `price` | Parsed as float |
| `price_change_day` | `change` | Parsed as float |
| `percentage_day` | `percentChange` | Parsed, strip `%` sign |
| (derived) | `tick` | `up` if change > 0, `down` if < 0, else `flat` |

---

## How to Verify Benchmarks

Test individual benchmarks:

```bash
curl -s "https://api.marketstack.com/v2/indexinfo?access_key=YOUR_KEY&benchmarks=nikkei_225,sp500,ftse_100"
```

List all available benchmarks:

```bash
curl -s "https://api.marketstack.com/v2/indexlist?access_key=YOUR_KEY&limit=100" | jq '.data[].benchmark'
```

Or in PowerShell:

```powershell
$response = Invoke-RestMethod "https://api.marketstack.com/v2/indexlist?access_key=$env:MARKETSTACK_API_KEY&limit=100"
$response.data | Select-Object benchmark, name, country
```

---

## Catalog File Location

All benchmark mappings are stored in:

```
frontend/src/data/exchanges/exchanges.catalog.json
```

Each exchange entry has:

```json
{
  "id": "tse-tokyo",
  "city": "Tokyo",
  "exchange": "Tokyo Stock Exchange (TSE)",
  "country": "Japan",
  "iso2": "JP",
  "tz": "Asia/Tokyo",
  "marketstack": {
    "benchmark": "nikkei_225",
    "indexName": "Nikkei 225"
  },
  "hoverColor": "#FF3B5C"
}
```

---

## Troubleshooting

### Exchange shows "···" instead of price

1. Check if benchmark key exists in gateway mapping:
   ```powershell
   # Get the benchmark from catalog
   $catalog = Get-Content "frontend/src/data/exchanges/exchanges.catalog.json" | ConvertFrom-Json
   $exchange = $catalog | Where-Object { $_.id -eq "your-exchange-id" }
   $exchange.marketstack.benchmark
   ```

2. Verify benchmark is mapped in `gateway/src/marketstack/adapter.ts`

3. If missing, add an alias (don't change the catalog):
   ```typescript
   your_benchmark: 'SYMBOL.INDX',
   ```

### Gateway returns fewer indices than expected

Check `ssotSource` in trace:
```powershell
(Invoke-RestMethod "https://promagen-api.fly.dev/trace").indices.ssotSource
```

- `frontend` = Good, using frontend config
- `fallback` = Bad, gateway couldn't fetch frontend config, using hardcoded fallback

Fix: Restart gateway after frontend deploy: `flyctl apps restart promagen-api`

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-14 | **PM: All indices LIVE** |
|            | Added benchmark aliases: djia, tsx, russell_2000 |
|            | Verified all 16 default exchanges showing prices |
|            | Added troubleshooting section |
| 2026-01-13 | Verified all 48 exchange benchmark mappings |
| 2026-01-13 | Added API response format documentation |
| 2026-01-12 | Initial document with expected benchmark keys |

---

_This document tracks Marketstack benchmark mappings. See `MARKETSTACK-ACTION-PLAN.md` for implementation status._
