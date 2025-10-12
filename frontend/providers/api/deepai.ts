// providers/deepai.ts
import type { ProviderDef, GenInput, GenOutput } from '../types';

export const deepaiProvider: ProviderDef = {
  id: 'deepai',
  label: 'DeepAI',
  name: 'deepai',
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
