// C:\Users\Proma\Projects\promagen\gateway\adapters\fmp.fx.ts

import type { FxAdapterRequest, FxAdapterResponse } from '../lib/types';

export default async function fmpFxAdapter(_req: FxAdapterRequest): Promise<FxAdapterResponse> {
  // Backup placeholder adapter:
  // If you want FMP live, we’ll wire it properly with a tested endpoint + env var.
  return {
    providerId: 'fmp',
    mode: 'live',
    pairs: [],
  };
}
