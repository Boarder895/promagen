// src/data/exchanges.ts
// Single import point for the stock exchanges catalog used by Stage-1/2.

import catalog from "@/data/exchanges.catalog.json";

export type Exchange = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  tz?: string;
  lat?: number;
  lon?: number;
  open?: string;
  close?: string;
  notes?: string;
};

export const EXCHANGES: Exchange[] = catalog as unknown as Exchange[];
export default EXCHANGES;

