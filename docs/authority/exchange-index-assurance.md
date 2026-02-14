# Promagen Exchange & Index Pipeline — End-to-End Assurance

**Date:** 14 February 2026
**Scope:** Confirm all 84 exchanges are active, all index data is being called for, and the pipeline is wired correctly from catalog → config route → gateway → Marketstack API → frontend card.

---

## 1. Catalog Confirmation

**File:** `frontend/src/data/exchanges/exchanges.catalog.json`

**Result: 84 exchanges. All have a `name` (short), `exchange` (full), and `marketstack` config with at least one index.**

Zero exchanges are missing index data. Every single one has a `defaultBenchmark` and at least one entry in `availableIndices`.

---

## 2. Index Coverage Summary

| Metric                                                | Count     |
| ----------------------------------------------------- | --------- |
| Total exchanges in catalog                            | 84        |
| Exchanges with index config                           | 84 (100%) |
| Total available indices across all exchanges          | 151       |
| Unique benchmark keys in catalog                      | 107       |
| Default benchmarks sent to gateway (one per exchange) | 84        |
| Unique default benchmarks after dedup                 | 78        |
| Unique benchmark keys mapped in gateway adapter       | 123       |
| Catalog benchmarks missing from gateway               | **0**     |

The gateway has mappings for all 107 unique benchmarks. 16 extra gateway mappings exist for indices not currently assigned to any exchange (future-proofing).

---

## 3. Why 84 Exchanges Produce 78 API Symbols

Some exchanges share the same default benchmark. The gateway deduplicates before calling Marketstack, so 84 exchange entries become 78 unique API symbols in one batch call.

| Shared Benchmark | Marketstack Symbol | Exchanges                                           |
| ---------------- | ------------------ | --------------------------------------------------- |
| `jp225`          | `N225.INDX`        | TSE (Tokyo), Fukuoka SE, Nagoya SE, Sapporo SE      |
| `de40`           | `GDAXI.INDX`       | Xetra (Frankfurt), FRA (Frankfurt), Börse Stuttgart |
| `csi_300`        | `CSI300.INDX`      | SSE (Shanghai), SZSE (Shenzhen)                     |

This is correct behaviour — the response data is fanned back out to all exchanges that share the benchmark.

---

## 4. Pipeline Trace

```
CATALOG (84 exchanges)
  │
  ▼
CONFIG ROUTE (/api/indices/config)
  │  Reads exchanges.catalog.json
  │  Extracts defaultBenchmark per exchange via Zod schema
  │  Sends all 84 as defaultExchangeIds[]
  │  Also sends freeDefaultIds (16 SSOT selected)
  │
  ▼
GATEWAY (server.ts → indices.ts → adapter.ts)
  │  Fetches config from promagen.com/api/indices/config
  │  parseCatalog() validates and filters to exchanges with valid mappings
  │  fetchQuotes() collects benchmark keys → adapter converts to Marketstack symbols
  │  Deduplicates: 84 benchmarks → 78 unique symbols
  │  Single batch GET to Marketstack: /v1/eod/latest?symbols=GSPC.INDX,N225.INDX,...
  │  MAX_SYMBOLS_PER_REQUEST = 100 (78 fits comfortably)
  │
  ▼
MARKETSTACK API
  │  Returns EOD data for all 78 symbols in one response
  │
  ▼
GATEWAY RESPONSE PARSING (adapter.ts → parseMarketstackResponse)
  │  Reverse maps: Marketstack symbol → benchmark key
  │  Matches to catalog items
  │  Adds null-price entries for any catalog items not in API response
  │
  ▼
FRONTEND (/api/indices → exchange cards)
  │  Polls gateway /indices endpoint
  │  Maps index data to exchange cards via benchmark key
  │  ExchangeCard renders: name (short) + city + index quote
```

---

## 5. Multi-Index Exchanges (Pro Feature)

28 of the 84 exchanges offer more than one index. The gateway currently fetches the **default benchmark only** per exchange. The additional indices are available in the catalog's `availableIndices` array for when Pro users select an alternative index.

Exchanges with multiple indices:

| Exchange               | Default           | Total Available |
| ---------------------- | ----------------- | --------------- |
| Xetra (Frankfurt)      | de40 (DAX)        | 9               |
| FRA (Frankfurt)        | de40 (DAX)        | 9               |
| Euronext Amsterdam     | nl25 (AEX)        | 6               |
| Euronext Brussels      | be20 (BEL 20)     | 6               |
| Euronext Paris         | fr40 (CAC 40)     | 6               |
| Börse Stuttgart        | de40 (DAX)        | 5               |
| NYSE (New York)        | us500 (S&P 500)   | 4               |
| Cboe (Chicago)         | us30 (Dow Jones)  | 4               |
| ASX (Sydney)           | asx200            | 4               |
| BME (Madrid)           | es35 (IBEX 35)    | 3               |
| Borsa Italiana (Milan) | it40 (FTSE MIB)   | 3               |
| Euronext Lisbon        | psi_20            | 3               |
| JSE (Johannesburg)     | jse (All Share)   | 3               |
| B3 (São Paulo)         | ibovespa          | 2               |
| LSE (London)           | gb100 (FTSE 100)  | 2               |
| Nasdaq Helsinki        | helsinki_25       | 2               |
| SIX (Zurich)           | ch20 (SMI)        | 2               |
| Bahrain Bourse         | estirad           | 2               |
| Fukuoka SE             | jp225 (Nikkei)    | 2               |
| Nagoya SE              | jp225 (Nikkei)    | 2               |
| Sapporo SE             | jp225 (Nikkei)    | 2               |
| TSE (Tokyo)            | jp225 (Nikkei)    | 2               |
| NGX (Lagos)            | nse_all_share     | 2               |
| BÉT (Budapest)         | bux               | 2               |
| CSE (Colombo)          | aspi              | 2               |
| SASE (Sarajevo)        | sasx_10           | 2               |
| MSE Mongolia           | mse_20            | 2               |
| NSE Nairobi            | nairobi_all_share | 2               |

The remaining 56 exchanges have exactly 1 index each.

---

## 6. Scheduler & Budget

| Setting                           | Value                               |
| --------------------------------- | ----------------------------------- |
| Refresh cadence                   | Every 15 min (:05, :20, :35, :50)   |
| Daily API calls                   | ~96 (4/hr × 24hr)                   |
| Monthly API calls                 | ~2,880                              |
| Marketstack budget (Professional) | 100,000/month                       |
| Budget usage                      | 2.88%                               |
| Batch size per call               | 78 unique symbols (under 100 limit) |

---

## 7. Free Tier Defaults (16 exchanges)

These 16 exchanges show by default for non-Pro users (from `exchanges.selected.json`):

NZX Wellington, ASX Sydney, TSE Tokyo, HKEX Hong Kong, SET Bangkok, NSE Mumbai, DFM Dubai, BIST Istanbul, JSE Johannesburg, LSE London, B3 São Paulo, Euronext Paris, TWSE Taipei, Cboe Chicago, TSX Toronto, NYSE New York.

All 16 exist in the 84-exchange catalog and have valid benchmark mappings.

---

## 8. Verdict

**All 84 exchanges are configured, mapped, and being called for.**

**All 107 unique benchmark keys have gateway mappings to Marketstack symbols.**

**The default index for every exchange is fetched in a single batch API call (78 unique symbols, within the 100-symbol limit).**

**No gaps. No orphaned exchanges. No unmapped indices.**
