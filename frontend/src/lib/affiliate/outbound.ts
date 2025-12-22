export function buildGoHref(providerId: string, src: string): string {
  const safeProviderId = encodeURIComponent(providerId);
  const safeSrc = encodeURIComponent(src);
  return `/go/${safeProviderId}?src=${safeSrc}`;
}
