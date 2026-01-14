// src/app/api/commodities/selection/route.ts
// =============================================================================
// Commodities Selection API Route (Pro only)
// Mirrors: src/app/api/fx/selection/route.ts
// =============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';

import {
  COMMODITIES_SELECTION_LIMITS,
  type CommoditiesSelectionPublicMetadata,
} from '@/types/commodities-selection';
import commoditiesJson from '@/data/commodities/commodities.catalog.json';
import { validateCommoditySelection } from '@/lib/ribbon/selection';
import type { Commodity, CommodityId } from '@/types/finance-ribbon';

interface SelectionRequestBody {
  commodityIds: unknown;
}

function normaliseIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim().toLowerCase();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

function getCatalogue(): Commodity[] {
  return Array.isArray(commoditiesJson) ? (commoditiesJson as unknown as Commodity[]) : [];
}

async function loadValidCommodityIds(): Promise<Set<string>> {
  const catalog = getCatalogue();
  const ids = new Set<string>();

  for (const c of catalog) {
    if (!c || typeof c.id !== 'string') continue;
    if (c.isActive === false) continue;
    ids.add(c.id.toLowerCase());
  }

  return ids;
}

export async function GET(): Promise<Response> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const meta = (user.publicMetadata ?? {}) as CommoditiesSelectionPublicMetadata;

    if (meta.tier !== 'paid') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const selection = meta.commoditiesSelection ?? null;

    return NextResponse.json(
      {
        commodityIds: selection?.commodityIds ?? [],
        updatedAt: selection?.updatedAt ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[commodities-selection-route] GET error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const meta = (user.publicMetadata ?? {}) as CommoditiesSelectionPublicMetadata;

    if (meta.tier !== 'paid') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    let body: SelectionRequestBody;
    try {
      body = (await req.json()) as SelectionRequestBody;
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const ids = normaliseIds(body.commodityIds);

    if (ids.length !== COMMODITIES_SELECTION_LIMITS.max) {
      return NextResponse.json(
        { error: 'invalid_selection_count', expected: COMMODITIES_SELECTION_LIMITS.max },
        { status: 400 },
      );
    }

    const validIds = await loadValidCommodityIds();
    const invalid = ids.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: 'invalid_ids', invalid }, { status: 400 });
    }

    // Validate 2–3–2 distribution using SSOT catalogue.
    const catalogue = getCatalogue();
    const validation = validateCommoditySelection(catalogue, ids as CommodityId[]);

    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'invalid_distribution', reason: validation.reason },
        { status: 400 },
      );
    }

    const updatedAt = new Date().toISOString();

    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...meta,
        commoditiesSelection: {
          commodityIds: ids,
          updatedAt,
        },
      },
    });

    return NextResponse.json({ ok: true, commodityIds: ids, updatedAt }, { status: 200 });
  } catch (error) {
    console.error('[commodities-selection-route] POST error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
