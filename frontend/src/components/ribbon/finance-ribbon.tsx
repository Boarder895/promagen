// frontend/src/components/ribbon/finance-ribbon.tsx

import * as React from 'react';

export type FinanceRibbonProps = {
  /**
   * When true, the ribbon runs in “demo” mode:
   * - Safe to render without real network calls
   * - Suitable for logged-out or preview states
   */
  demo?: boolean;

  /**
   * Explicit list of FX pair IDs to show, e.g. ["EURUSD", "GBPUSD"].
   * If omitted, a small, sensible default set is used.
   */
  pairIds?: string[];

  /** Reserved for future polling / animation cadence. */
  intervalMs?: number;
};

/**
 * Contract for the default FX pairs rendered by the ribbon.
 * This is what the contracts test asserts against.
 */
const DEFAULT_PAIR_IDS: string[] = ['EURUSD', 'GBPUSD', 'EURGBP'];
const DEFAULT_INTERVAL_MS = 10_000;

export const FinanceRibbon: React.FC<FinanceRibbonProps> = ({
  demo = false,
  pairIds,
  intervalMs = DEFAULT_INTERVAL_MS,
}) => {
  // intervalMs is reserved for future animation / polling, but wired up now
  // so the prop surface is stable and fully typed.
  void intervalMs;

  const ids = pairIds && pairIds.length > 0 ? pairIds : DEFAULT_PAIR_IDS.slice();

  const label = demo ? 'Live FX pairs (demo values)' : 'Live FX pairs';

  return (
    <section
      aria-label={label}
      className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
      data-testid="finance-ribbon"
    >
      <ul className="flex flex-wrap items-centre gap-2">
        {ids.map((id) => (
          <li
            key={id}
            className="whitespace-nowrap rounded-full bg-white/5 px-3 py-1 text-white/80 shadow-sm ring-1 ring-white/10"
            data-testid={`fx-${id}`}
          >
            <span className="font-mono tracking-tight">{id}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default FinanceRibbon;
