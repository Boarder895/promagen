import type { ProviderDef, GenInput, GenOutput } from '../types';

export const openaiProvider: ProviderDef = {
  id: 'openai',
  label: 'OpenAI',
  name: 'openai',

  supportsNegative: false,
  supportsSeed: false,
  supportsSize: true,
  supportsStyle: true, // ? add this

  async test() {
    return { ok: true };
  },

  async generate(_input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending (add API endpoint + auth)');
  },
};





