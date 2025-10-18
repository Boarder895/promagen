import type { ProviderDef, GenInput, GenOutput } from './types';

export const adapter: ProviderDef = {
  id: 'yourname',
  label: 'Your Label', // UI/export label
  supportsNegative: true, // ? fix (was supportsNegative)
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true,
  async test() {
    return { ok: true };
  },
  async generate(_input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending');
  },
};
export default adapter;





