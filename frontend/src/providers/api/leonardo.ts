import type { ProviderDef, GenInput, GenOutput } from '../types';

export const leonardoProvider: ProviderDef = {
  id: 'leonardo',
  label: 'Leonardo',
  name: 'leonardo',

  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true, // ? add this

  async test() {
    return { ok: true };
  },
  async generate(_input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending (add API endpoint + auth)');
  },
};








