import type { ProviderDef, GenInput, GenOutput } from '../types';

export const recraftProvider: ProviderDef = {
  id: 'recraft',
  label: 'Recraft',
  name: 'recraft',

  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true, // ? add this

  async test() {
    return { ok: true };
  },

  async generate(input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending (add API endpoint + auth)');
  },
};
