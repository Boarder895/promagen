import type { ProviderDef, GenInput, GenOutput } from '../types';

export const lexicaProvider: ProviderDef = {
  id: 'hive',
  label: 'Hive',
  name: 'hive',

  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true, // ? this was missing
  // supportsModelSelect: true,  // only if this adapter actually needs it

  async test() {
    return { ok: true };
  },

  async generate(_input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending (add API endpoint + auth)');
  },
};





