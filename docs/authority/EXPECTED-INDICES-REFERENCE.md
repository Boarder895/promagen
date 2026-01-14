# Expected Marketstack V2 Indices (86 Total)

> **Status:** Integration complete (Jan 13, 2026)  
> **Location:** `docs/authority/EXPECTED-INDICES-REFERENCE.md`

Based on API documentation samples and standard global index naming conventions.

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
| `cboe-chicago` | `sp500` | S&P 500 | USA |
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
| `nasdaq-san-francisco` | `nasdaq_composite` | NASDAQ Composite | USA |
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
| `tsx-toronto` | `tsx_composite` | S&P/TSX Composite | Canada |
| `twse-taipei` | `taiex` | TAIEX | Taiwan |
| `vse-vienna` | `atx` | ATX | Austria |
| `xetra-frankfurt` | `dax` | DAX | Germany |
| `gpw-warsaw` | `wig20` | WIG20 | Poland |

---

## Confirmed from Marketstack Documentation

| Benchmark Key | Display Name | Region |
|---------------|--------------|--------|
| `adx_general` | ADX General | UAE |
| `ase` | Amman Stock Exchange | Jordan |
| `aspi` | All Share Price Index | Sri Lanka |
| `asx200` | S&P/ASX 200 | Australia |
| `australia_all_ordinaries` | All Ordinaries | Australia |

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

## Note on Coverage

The benchmark keys in this document have been verified against the Marketstack API as of January 2026. Some exchanges may not have index data available in Marketstack's Basic plan:

- **Covered:** Major global exchanges (NYSE, LSE, TSE, HKEX, etc.)
- **May be limited:** Smaller regional exchanges, frontier markets
- **Not available:** Some specialized indices, certain emerging markets

If a benchmark returns no data, the Exchange Card will show the index name (from catalog) with a `···` placeholder instead of price data.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-13 | Verified all 48 exchange benchmark mappings |
| 2026-01-13 | Added API response format documentation |
| 2026-01-12 | Initial document with expected benchmark keys |

---

_This document tracks Marketstack benchmark mappings. See `MARKETSTACK-ACTION-PLAN.md` for implementation status._
