// Very small helper – accept Date or epoch ms.
export function sunriseUtc(base: number | Date, coords: { lat: number; lon: number }): Date {
  const d = typeof base === 'number' ? new Date(base) : base;
  // Stub: return 6:00 UTC for the given day. Good enough for compile + demo.
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 6, 0, 0));
  return out;
}
export default sunriseUtc;
