// frontend/src/components/ribbon/finance-ribbon.tsx

import * as React from "react";

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

  /**
   * Intended refresh / animation interval in milliseconds.
   * Currently plumbed for future behaviour; not required for rendering.
   */
  intervalMs?: number;
};

/**
 * Default FX pair ids used when the caller does not supply pairIds.
 * This is what the contracts test asserts against.
 */
const DEFAULT_PAIR_IDS: string[] = ["EURUSD", "GBPUSD", "EURGBP"];
const DEFAULT_INTERVAL_MS = 10_000;

export const FinanceRibbon: React.FC<FinanceRibbonProps> = ({
  demo = false,
  pairIds,
  intervalMs = DEFAULT_INTERVAL_MS,
}) => {
  // intervalMs is reserved for future animation / polling, but wired up now
  // so the prop surface is stable and fully typed.
  void intervalMs;

  const ids = pairIds && pairIds.length > 0 ? pairIds : DEFAULT_PAIR_IDS;

  return (
    <section
      role="region"
      aria-label="Foreign exchange pairs"
      data-testid="finance-ribbon"
      data-demo={demo ? "true" : "false"}
      className="w-full overflow-x-auto py-2"
    >
      <ul role="list" className="flex flex-row gap-3 text-sm">
        {ids.map((id) => (
          <li
            key={id}
            role="listitem"
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
