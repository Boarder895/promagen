import type { ProviderDef, GenInput, GenOutput } from './types';

const LEONARDO_API_KEY = process.env.LEONARDO_API_KEY ?? '';
const BASE = 'https://cloud.leonardo.ai/api/rest/v1/';

export const leonardoProvider: ProviderDef = {
  id: 'leonardo',
  label: 'Leonardo',
  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true,

  async test() {
    return { ok: true as const };
  },

  async generate(_input: GenInput): Promise<GenOutput> {
    // Wire real API later: fetch(`${BASE}…`, { headers: { Authorization: `Bearer ${LEONARDO_API_KEY}` } })
    throw new Error('NOT_CONFIGURED: Adapter pending (add endpoint + auth + mapping)');
  },
};
