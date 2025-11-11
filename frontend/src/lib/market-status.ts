// src/lib/marketStatus.ts
const holidays: string[] = []; // stage-1 placeholder

export function isMarketOpen(_tz: string, _now = new Date()): boolean {
  void _tz;
  const day = _now.getDay();
  const closed = day === 0 || day === 6 || holidays.includes(_now.toISOString().slice(0, 10));
  return !closed;
}








