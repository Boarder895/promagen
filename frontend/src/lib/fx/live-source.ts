// frontend/src/lib/fx/live-source.ts
//
// Server-side only: returns normalised snapshots for a list of FX pairs.
//
// Pro posture (non-negotiable):
// - This module MUST NOT call third-party FX providers directly.
// - All upstream spend must pass through the FX Refresh Authority (src/lib/fx/providers.ts).
// - Keeping the client on /api/fx allows Vercel WAF + rate limiting rules to be surgical.
//
// Historical note:
// This file previously talked directly to FastForex. That is now forbidden by the
// no-bypass checklist in promagen-api-brain-v2.
//
// This module must never be imported from a client component.

import 'server-only';

import type { FxPairMeta } from './map-api-to-quotes';
import type { FxSnapshot } from './fetch';
import { getFxRibbon } from './providers';

function normaliseId(id: string): string {
  return id
    .trim()
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type FxRibbonApiQuote = {
  id: string;
  price: number | null;
};

const lastSeenById = new Map<string, { value: number; asOf: string }>();

/**
 * Fetch snapshots for a set of FX pairs.
 *
 * IMPORTANT:
 * - This never triggers direct upstream calls.
 * - It reads from the Refresh Authority, which decides live vs cached vs demo.
 */
export async function fetchLiveFxSnapshots(pairs: FxPairMeta[]): Promise<FxSnapshot[]> {
  if (pairs.length === 0) {
    return [];
  }

  const ribbon = await getFxRibbon();

  const metaAsOf =
    isRecord(ribbon) && isRecord((ribbon as Record<string, unknown>).meta)
      ? readString(((ribbon as Record<string, unknown>).meta as Record<string, unknown>).asOf)
      : null;

  const asOf = metaAsOf ?? new Date().toISOString();

  const dataRaw =
    isRecord(ribbon) && Array.isArray((ribbon as Record<string, unknown>).data)
      ? ((ribbon as Record<string, unknown>).data as unknown[])
      : [];

  const quotesById = new Map<string, FxRibbonApiQuote>();

  for (const item of dataRaw) {
    if (!isRecord(item)) continue;
    const id = readString(item.id);
    if (!id) continue;

    const price = readNumber(item.price);
    quotesById.set(normaliseId(id), { id: normaliseId(id), price });
  }

  const snapshots: FxSnapshot[] = [];

  // Sequential mapping on purpose; this is just shaping data, not IO fan-out.
  for (const meta of pairs) {
    const id = normaliseId(meta.id);
    if (!id) continue;

    const q = quotesById.get(id);
    if (!q) continue;

    const value = typeof q.price === 'number' && Number.isFinite(q.price) ? q.price : null;
    if (value === null) continue;

    const prev = lastSeenById.get(id)?.value ?? value;

    snapshots.push({
      id,
      value,
      prevClose: prev,
      asOf,
    });

    lastSeenById.set(id, { value, asOf });
  }

  return snapshots;
}
