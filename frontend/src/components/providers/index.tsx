// Legacy compatibility shim.
// Some older code imported from "@/components/providers" expecting a list.
// We now re-export the canonical registry so those imports continue to work.

export { PROVIDERS } from '@/lib/providers';
export type { Provider, ProviderId, ProviderMeta } from '@/lib/providers';




