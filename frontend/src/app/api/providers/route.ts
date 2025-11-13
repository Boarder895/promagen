// frontend/src/app/api/providers/route.ts
import { NextResponse } from 'next/server';
import type { Provider } from '@/types/providers';

// Runtime-safe import that tolerates default or named export without 'any'.
function asProviders(mod: unknown): Provider[] {
  if (Array.isArray(mod)) return mod;
  if (mod && typeof mod === 'object') {
    const m = mod as Record<string, unknown>;
    const candidates = ['default', 'CATALOG', 'catalog', 'providers', 'PROVIDERS'] as const;
    for (const k of candidates) {
      const v = m[k as string];
      if (Array.isArray(v)) return v as Provider[];
    }
  }
  return [];
}

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('@/data/providers');
  const providers = asProviders(raw);
  return NextResponse.json(providers, { status: 200 });
}
