// src/lib/exchangeStatus.ts
// Canonical ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œexchange statusÃƒÂ¢Ã¢â€šÂ¬Ã‚Â adapter around markets + time helpers.
// Named exports only.

import { MarketList } from "@/lib/markets";
import { computeMarket } from "@/lib/markets"

export type ExchangeStatus = ReturnType<typeof computeMarket>;

export const getExchangeStatuses = (): ExchangeStatus[] =>
  MarketList.map((m) => computeMarket(m));

export const getExchangeStatusesPayload = () => ({
  data: getExchangeStatuses(),
  generatedAt: new Date().toISOString(),
});


