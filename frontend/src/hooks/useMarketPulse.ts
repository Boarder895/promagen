// @/hooks/useMarketPulse.ts
'use client';

import { useSyncExternalStore } from 'react';
import {
  getPulseState,
  subscribePulse,
  setRegionsMOF,
  type PulseState,
  type RegionMOF,
} from '@/lib/marketPulse';

export function useMarketPulse(): PulseState {
  return useSyncExternalStore(subscribePulse, getPulseState, getPulseState);
}

export function useSetRegionsMOF(): (regions: RegionMOF, anyOpen: boolean, nextFlipTs?: number) => void {
  return setRegionsMOF;
}
