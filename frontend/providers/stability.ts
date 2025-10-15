// frontend/providers/stability.ts
import type { ProviderDef, GenInput, GenOutput } from './types';

export const stabilityProvider: ProviderDef = {
  id: 'stability',
  label: 'Stability AI',
  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true,

  async test() {
    return { ok: true as const };
  },

  async generate(_input: GenInput): Promise<GenOutput> {
    // Wire the real endpoint later (auth + mapping)
    throw new Error('NOT_CONFIGURED: Adapter pending (add endpoint + auth)');
  },
};

export default stabilityProvider; // remove this line if you’re using named imports only
