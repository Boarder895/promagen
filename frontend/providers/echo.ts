import type { ProviderDef, GenInput, GenOutput } from './types';

export const echoProvider: ProviderDef = {
  id: 'echo',
  label: 'echo (dev)',
  supportsNegative: false,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true,
  async test() {
    return { ok: true };
  },
  async generate(_input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending (dev stub)');
  },
};

export default echoProvider;
