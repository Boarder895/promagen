import type { ProviderDef, GenInput, GenOutput } from '../types';

export const edenaiProvider: ProviderDef = {
  id: 'edenai',
  label: 'Eden AI',
  name: 'edenai',

  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true,

  async test() {
    return { ok: true };
  },

  async generate(input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending (add API endpoint + auth)');
  },
};
