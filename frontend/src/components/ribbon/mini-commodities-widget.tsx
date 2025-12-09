// src/components/ribbon/mini-commodities-widget.tsx

import type { JSX } from 'react';

import freeCommodityIdsJson from '@/data/selected/commodities.free.json';
import commoditiesCatalogJson from '@/data/commodities/commodities.catalog.json';
import type { Commodity } from '@/data/commodities/commodities.schema';

/**
 * MiniCommoditiesWidget
 *
 * Free tier:
 * - 7 chips total.
 * - Conceptual 2·3·2 crown layout:
 *   - Group A (2)   – typically Energy
 *   - Group B (3)   – user’s “crown” category (e.g. Agriculture in free tier)
 *   - Group C (2)   – typically Metals
 *
 * The exact IDs and ordering are driven by:
 *   src/data/selected/commodities.free.json
 *
 * That JSON is the single source of truth for the free-tier commodities row.
 */

// The JSON selection, in order (should currently be 7 IDs).
const FREE_COMMODITY_IDS: string[] = freeCommodityIdsJson as string[];

// Catalogue entries as defined by the schema.
type CatalogCommodity = Commodity;

// Build a lookup of id -> commodity from the catalogue.
// This keeps the component aligned with the commodities SSOT.
const COMMODITIES_BY_ID: Record<string, CatalogCommodity> = Object.fromEntries(
  (commoditiesCatalogJson as CatalogCommodity[]).map((commodity) => [commodity.id, commodity]),
);

/**
 * Resolve the free-tier commodities from the selected IDs JSON.
 *
 * - Respects the order in commodities.free.json (which encodes the 2·3·2 pattern).
 * - Does NOT drop items based on flags; the JSON selection is treated as canonical.
 *   (If a flag and the JSON ever disagree, we still want the widget + test stable.)
 */
function resolveFreeCommodities(): CatalogCommodity[] {
  const result: CatalogCommodity[] = [];

  for (const rawId of FREE_COMMODITY_IDS) {
    // Normalise any hyphenated IDs into the underscore pattern used in the catalogue.
    const normalisedId = rawId.replace(/-/gu, '_');

    const commodity = COMMODITIES_BY_ID[normalisedId];

    // If the ID is missing from the catalogue, just skip it rather than crashing.
    if (!commodity) {
      continue;
    }

    result.push(commodity);
  }

  return result;
}

export function MiniCommoditiesWidget(): JSX.Element | null {
  const freeCommodities = resolveFreeCommodities();

  // Defensive: if config ever goes bad, don’t render a broken strip.
  if (freeCommodities.length === 0) {
    return null;
  }

  // We only care about the first 7 for this widget, in order.
  const limited = freeCommodities.slice(0, 7);

  // 2·3·2 layout over the first 7 items:
  // [0,1] -> Group A (2)
  // [2,3,4] -> Group B (3)
  // [5,6] -> Group C (2)
  const groupA = limited.slice(0, 2);
  const groupB = limited.slice(2, 5);
  const groupC = limited.slice(5, 7);

  const groups: CatalogCommodity[][] = [groupA, groupB, groupC];

  return (
    <section
      data-testid="mini-commodities-widget"
      aria-label="Popular commodities"
      className="flex flex-col items-center gap-1 text-xs"
    >
      <h3 className="font-medium uppercase tracking-wide">Commodities</h3>

      <div className="flex flex-col items-center gap-1">
        {groups.map((group, groupIndex) => (
          <ol
            key={`mini-commodities-group-${groupIndex}`}
            className="flex flex-row items-center justify-center gap-1"
          >
            {group.map((commodity) => (
              <li key={commodity.id}>
                <span className="inline-flex rounded-full border px-2 py-0.5">
                  {commodity.shortName ?? commodity.name}
                </span>
              </li>
            ))}
          </ol>
        ))}
      </div>
    </section>
  );
}

export default MiniCommoditiesWidget;
