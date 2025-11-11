import type { ExchangeId, ExchangeMeta } from "@/types/ribbon";

export type AllowedN = 6 | 8 | 10 | 12 | 14 | 16;
export const AllowedEvenNs: AllowedN[] = [6, 8, 10, 12, 14, 16];

export type BalanceAction =
  | { type: "autofill"; ids: ExchangeId[]; from?: number; to?: number }
  | { type: "autobump"; from: number; to: number };

export interface BalanceArgs {
  selectedIds: ExchangeId[];
  n?: number;
  catalog: Record<ExchangeId, ExchangeMeta> | ExchangeMeta[];
}

export interface BalanceResult {
  east: ExchangeMeta[];
  west: ExchangeMeta[];
  notes: BalanceAction[];
  autofilled: ExchangeId[];
  n: AllowedN | null;
}

function toCatalogMap(
  catalog: Record<ExchangeId, ExchangeMeta> | ExchangeMeta[]
): Record<ExchangeId, ExchangeMeta> {
  if (Array.isArray(catalog)) {
    return Object.fromEntries(catalog.map((m) => [m.id, m])) as Record<
      ExchangeId,
      ExchangeMeta
    >;
  }
  return catalog;
}

function nearestAllowedAtLeast(x: number): AllowedN {
  const target = Math.max(6, Math.min(16, x));
  const even = target % 2 === 0 ? target : target + 1;
  for (const a of AllowedEvenNs) {
    if (even <= a) {return a;}
  }
  return 16;
}

function coerceAllowedN(n: number | null | undefined): AllowedN | null {
  if (typeof n !== "number") {return null;}
  return nearestAllowedAtLeast(n);
}

export async function buildBalancedRibbon(
  args: BalanceArgs
): Promise<BalanceResult> {
  const catalog = toCatalogMap(args.catalog);
  const selected = Array.from(
    new Set(args.selectedIds.filter((id) => id in catalog))
  ) as ExchangeId[];

  let n: AllowedN | null =
    coerceAllowedN(args.n) ?? nearestAllowedAtLeast(selected.length);
  if (n && !AllowedEvenNs.includes(n)) {
    n = nearestAllowedAtLeast(n);
  }

  return {
    east: [],
    west: [],
    notes: [],
    autofilled: [],
    n,
  };
}



