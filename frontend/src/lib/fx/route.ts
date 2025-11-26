// frontend/src/app/api/ribbon/fx/route.ts
//
// /api/ribbon/fx — lightweight FX endpoint for the finance ribbon.
//
// Shape: FxSnapshot[]
//
// This route is intentionally simple: the client already knows whether it is
// in live or demo mode, and will fall back to demo data if this route fails.
// All provider integration and env handling lives on the server.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import pairsJson from '@/data/pairs.json';
import { fetchLiveFxSnapshots } from '@/lib/fx/live-source';
import type { FxSnapshot } from '@/lib/fx/fetch';
import type { FxPairMeta } from '@/lib/fx/map-api-to-quotes';

type PairConfig = {
  id: string;
  base?: string;
  quote?: string;
};

const pairs = pairsJson as PairConfig[];

function resolvePairMeta(ids: string[]): FxPairMeta[] {
  return ids.map((id) => {
    const config = pairs.find((item) => item.id === id);

    if (!config) {
      // As a last resort, try to derive base / quote from the id.
      const normalised = id.replace(/_/g, '-').toUpperCase();
      const [base, quote] = normalised.split('-');

      if (!base || !quote) {
        throw new Error(`Unable to resolve FX pair metadata for id "${id}"`);
      }

      return {
        id,
        base,
        quote,
        label: `${base} / ${quote}`,
      };
    }

    const normalisedBase = (config.base ?? '').toUpperCase();
    const normalisedQuote = (config.quote ?? '').toUpperCase();

    if (!normalisedBase || !normalisedQuote) {
      throw new Error(`FX pair "${id}" is missing base or quote in pairs.json`);
    }

    return {
      id,
      base: normalisedBase,
      quote: normalisedQuote,
      label: `${normalisedBase} / ${normalisedQuote}`,
    };
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pairsParam = url.searchParams.get('pairs');

  if (!pairsParam) {
    return NextResponse.json<FxSnapshot[]>([], {
      status: 200,
      headers: {
        'cache-control': 'no-store',
      },
    }) as unknown as Response;
  }

  const ids = pairsParam
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json<FxSnapshot[]>([], {
      status: 200,
      headers: {
        'cache-control': 'no-store',
      },
    }) as unknown as Response;
  }

  try {
    const metas = resolvePairMeta(ids);
    const snapshots = await fetchLiveFxSnapshots(metas);

    return NextResponse.json<FxSnapshot[]>(snapshots, {
      status: 200,
      headers: {
        'cache-control': 'no-store',
      },
    }) as unknown as Response;
  } catch (error) {
    // Let the client-side ribbon fall back to demo mode when this fails.
    console.error('FX ribbon live fetch failed', error);

    return NextResponse.json(
      { error: 'FX_LIVE_FAILED' },
      {
        status: 502,
        headers: {
          'cache-control': 'no-store',
        },
      },
    ) as unknown as Response;
  }
}
