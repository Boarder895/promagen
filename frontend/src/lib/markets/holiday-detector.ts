// frontend/src/lib/markets/holiday-detector.ts
// Compile-friendly stubs matching current tests & call shapes.
// You can swap in real logic later without changing signatures.

export type Session = { days: string; open: string; close: string };

export type Template = {
  label: string;
  session: Session[];
  // tests sometimes pass Date; accept both
  tzNow?: string | Date;
  tZNow?: string | Date;
  [key: string]: unknown;
};

export type OpenState =
  | 'open'
  | 'closed-out-of-hours'
  | 'closed-holiday'
  | 'probable-holiday';

export type OpenResult = { state: OpenState };

/**
 * Tests call this in two ways:
 * 1) evaluateExchangeOpenState({ label, session, ... })                      // single-arg
 * 2) evaluateExchangeOpenState({ tzNow, utcNow, template, detector, ... })   // big config object
 * We accept either, plus the positional (template, tz, now) form.
 */
export function evaluateExchangeOpenState(
  arg: Template | Record<string, unknown>
): OpenResult;
export function evaluateExchangeOpenState(
  template: Template,
  tz: string,
  now?: Date
): OpenResult;
export function evaluateExchangeOpenState(
  arg: Template | Record<string, unknown>,
  _tz?: string,
  _now?: Date
): OpenResult {
  // If a big config object was passed, prefer its embedded template when present.
  const maybeTemplate =
    (arg as any)?.template && typeof (arg as any).template === 'object'
      ? (arg as any).template
      : arg;

  // minimal, deterministic placeholder; replace with your real market-hours logic later
  void maybeTemplate; // keep TS quiet until real logic lands
  return { state: 'open' };
}

/** Placeholder until we wire a real holiday library. */
export function probableHoliday(_isoDate: string, _iso2?: string): boolean {
  return false;
}
