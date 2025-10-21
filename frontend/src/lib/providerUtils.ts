// src/lib/providerUtils.ts
/**
 * Small helpers for provider objects so UI can safely read labels.
 */
type ProviderLike = { displayName?: string; name?: string; id?: string } | null | undefined;

export function getProviderLabel(p: ProviderLike): string {
  if (!p) return "Unknown Provider";
  return (p.displayName ?? p.name ?? p.id ?? "Unknown Provider") as string;
}







