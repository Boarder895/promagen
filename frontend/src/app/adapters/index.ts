// src/app/adapters/index.ts
// Minimal, typed adapter registry for Stage 1 (no runtime logic yet).

export type Adapter = {
  id: string;
  title: string;
  description?: string;
};

export const ADAPTERS: Adapter[] = [];

export type AdapterMap = Record<string, Adapter>;
export const ADAPTERS_BY_ID: AdapterMap = Object.fromEntries(
  ADAPTERS.map((a) => [a.id, a])
) as AdapterMap;





