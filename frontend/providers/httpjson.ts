import type { ProviderDef, GenInput, GenOutput } from './types';

function env(name: string, fallback?: string) {
  const v = process.env[name];
  if (v === undefined && fallback === undefined) {
    throw new Error(`Missing env ${name}`);
  }
  return v ?? fallback!;
}

export const httpjsonProvider: ProviderDef = {
  id: 'httpjson',
  label: 'HTTP JSON',
  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsStyle: true,
  async test() {
    return { ok: true as const };
  },
  async generate(_input: GenInput): Promise<GenOutput> {
    throw new Error('NOT_CONFIGURED: Adapter pending (add endpoint + auth + mapping)');
  },
};
