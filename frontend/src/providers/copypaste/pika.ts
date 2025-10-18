import type { ProviderDef, GenInput, GenOutput } from '../types';

/**
 * Copy/paste export stub for "pika".
 * These files are EXCLUDED from the TS build; they only drive the UI's export/copy flow.
 */
export const pikaProvider: ProviderDef = {
  id: 'pika',
  label: 'Pika',
  name: 'PIKA',

  // All flags true so the UI can expose full prompt controls in export flows.
  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true,

  test() {
    return { ok: true };
  },

  async generate(_input: GenInput): Promise<GenOutput> {
    // No direct API here—this provider is export-only (copy/paste workflow).
    throw new Error('NOT_CONFIGURED: Export-only provider; use copy/paste workflow.');
  },
};





