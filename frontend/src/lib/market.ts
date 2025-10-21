import type { MarketStatus } from "@/types/ribbon";

/** Stage-1 placeholder: always 'unknown'. */
export function computeStatus(): MarketStatus {
  return "unknown";
}

/** Some code calls this; return a small canned object. */
export async function fetchMarketQuote(_id: string): Promise<{ status: MarketStatus; nextChangeISO: string | null; }> {
  return { status: "unknown", nextChangeISO: null };
}

