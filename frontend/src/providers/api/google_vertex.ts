import type { ProviderDef, GenInput, GenOutput } from '../types';

export const googleVertexProvider: ProviderDef = {
  id: 'google-vertex',
  label: 'Google Vertex',
  name: 'google-vertex',

  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true,

  async test() {
    return { ok: true };
  },

  async generate(_input: GenInput): Promise<GenOutput> {
    // TODO: wire real Vertex call + auth using google-auth-library (server-side only)
    throw new Error('NOT_CONFIGURED: Adapter pending (add API endpoint + auth)');
  },
};





