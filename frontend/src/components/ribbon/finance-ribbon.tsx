import React from "react";

export type FinanceRibbonProps = {
  /** Demo mode shows a badge and static rows. */
  demo?: boolean;
  /** Exact FX pair ids to render (e.g., "EURUSD"). Defaults to 3 canonical pairs. */
  pairIds?: ReadonlyArray<string>;
  /**
   * Optional refresh cadence in ms (accepted by tests, not used in demo).
   * Kept for API stability; underscore prefix satisfies the unused-var rule.
   */
  intervalMs?: number;
};

const DEFAULT_PAIRS: ReadonlyArray<string> = ["EURUSD", "GBPUSD", "EURGBP"];

export default function FinanceRibbon(props: FinanceRibbonProps): JSX.Element {
  const { demo = false, pairIds, intervalMs: _intervalMs } = props; // underscore => lint-clean by convention
  const pairs = (pairIds?.length ? pairIds : DEFAULT_PAIRS).slice(0, 6);

  return (
    <section
      aria-label="Finance ribbon"
      data-testid="finance-ribbon"
      className="w-full overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10"
    >
      {demo ? (
        <div className="flex flex-row items-center gap-4 px-4 py-2 text-sm text-white/80">
          <span aria-label="demo mode badge" className="rounded bg-white/10 px-2 py-0.5 text-xs">
            Demo
          </span>
          {pairs.length === 0 ? (
            <span className="text-white/60">No pairs selected</span>
          ) : (
            <ul role="list" aria-label="demo pairs" className="flex gap-4">
              {pairs.map((id) => (
                <li key={id} role="listitem" data-testid={`fx-${id}`} className="tabular-nums">
                  {id}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="px-4 py-2 text-sm text-white/80">
          {/* Live mode: wire your data feed here later; DOM contract mirrors demo */}
          <ul role="list" aria-label="live pairs" className="flex gap-4">
            {pairs.map((id) => (
              <li key={id} role="listitem" data-testid={`fx-${id}`} className="tabular-nums">
                {id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
