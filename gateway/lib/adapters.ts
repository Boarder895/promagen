// gateway/lib/adapters.ts

import type { FxMode, FxRibbonPair, FxRibbonQuote } from './types';

export type FxAdapterRequest = {
  roleId: string;
  requestedPairs: FxRibbonPair[];
};

export type RoleAdapterContext = FxAdapterRequest;

export type RoleAdapterResponse = {
  providerId: string; // e.g. "twelvedata"
  mode: FxMode;
  pairs: FxRibbonQuote[];
};

export type RoleAdapter = (ctx: RoleAdapterContext) => Promise<RoleAdapterResponse>;
