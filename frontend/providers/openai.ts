import type { ProviderDef, GenInput, GenOutput } from './types';

export const openaiProvider: ProviderDef = {
  id: 'openai',
  label: 'OpenAI',

  // canonical flags
  supportsNegative: false,
  supportsSeed: false,
  supportsSize: true,
  supportsStyle: true,

  async test() {
    return { ok: true } as const;
  },

  async generate(_input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending (add endpoint + auth)');
  },
};
