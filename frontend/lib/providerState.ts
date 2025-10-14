export type ProviderState = Record<string, unknown>;
export const providerState: ProviderState = {};
export function getProviderState(){ return providerState; }
export function setProviderState(next: ProviderState){ Object.assign(providerState, next); }
export default providerState;
