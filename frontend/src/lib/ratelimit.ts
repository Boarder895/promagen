export function clientIpFromXff(xffHeader?: string | null): string | null {
  if (!xffHeader) return null;
  const first = xffHeader.split(',')[0]?.trim();
  return first?.length ? first : null;
}

export function extractQuoted(header?: string | null): string | null {
  if (!header) return null;
  const m = /"([^"]+)"/.exec(header);
  return m?.[1] ?? null;
}
