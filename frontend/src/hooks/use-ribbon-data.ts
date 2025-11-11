"use client";

import { useMemo } from "react";
import { getSelectedExchanges } from "@/lib/exchanges-ui";

export type RibbonItem = {
  code: string;
  name: string;
  city?: string;
  tz?: string;
};

export function useRibbonData(): RibbonItem[] {
  return useMemo(() => {
    const list = getSelectedExchanges();
    return list.map(e => ({
      code: String(e.id ?? ""),
      name: String(e.name ?? ""),
      city: e.city,
      tz: e.tz,
    }));
  }, []);
}

/* Keep both named and default to satisfy mixed import styles */
export default useRibbonData;

