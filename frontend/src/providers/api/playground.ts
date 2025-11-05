import type { ProviderDef, GenInput, GenOutput } from '../types';

export const playgroundProvider: ProviderDef = {
  id: 'playground',
  label: 'Playground AI',
  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true,
  async test() {
    return { ok: true };
  },
  async generate(_input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending (add API endpoint + auth)');
  },
};








