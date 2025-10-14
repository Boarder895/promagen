// Minimal stub so admin sync can call a stable function.
// Exported both as named and default to satisfy any import style.

export type ProviderRefreshResult = {
  updated: number;
  message?: string;
};

export async function refreshProviders(): Promise<ProviderRefreshResult> {
  // TODO: call your backend collector or Prisma updates here.
  return { updated: 0, message: 'Provider registry refresh (stub).' };
}

export default refreshProviders;
