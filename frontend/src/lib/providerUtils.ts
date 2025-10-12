/**
 * src/lib/providerUtils.ts
 * Small helpers for provider objects so UI can safely read labels.
 */

export function getProviderLabel(p: any): string {
  if (!p) return "Unknown Provider";
  // prefer explicit displayName, then name, then id
  return (p.displayName ?? p.name ?? p.id ?? "Unknown Provider") as string;
}


