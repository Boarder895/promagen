import type { ProviderDef, GenInput, GenOutput } from '../types';

export const artistlyProvider: ProviderDef = {
  id: 'artistly',
  label: 'Artistly',
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





