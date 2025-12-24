// src/components/providers/providers-table.tsx

import React from 'react';
import type { Provider } from '@/types/provider';
import { buildGoHref } from '@/lib/affiliate/outbound';
import { toRomanNumeral } from '@/lib/format/number';
import { Flag } from '@/components/ui/flag';

export type ProvidersTableProps = {
  providers: ReadonlyArray<Provider>;

  /** Optional heading text (some pages render their own headings). */
  title?: string;

  /** Optional caption/description (some pages render their own copy). */
  caption?: string;

  /** Optional row limit. When set, the table renders at most this many providers. */
  limit?: number;

  /** Optional rank column toggle (kept for backwards compatibility). */
  showRank?: boolean;
};

type PromagenUsersCountryUsage = {
  countryCode: string;
  count: number;
};

type ProviderWithPromagenUsers = Provider & {
  /**
   * Analytics-derived (MUST NOT come from providers.json).
   * Sorted highest-first by count.
   */
  promagenUsers?: ReadonlyArray<PromagenUsersCountryUsage>;
};

function hasOutboundDestination(provider: Provider): boolean {
  return Boolean(provider.affiliateUrl ?? provider.url ?? provider.website);
}

function chunkPairs<T>(items: ReadonlyArray<T>): Array<ReadonlyArray<T>> {
  const out: Array<ReadonlyArray<T>> = [];
  for (let i = 0; i < items.length; i += 2) {
    out.push(items.slice(i, i + 2));
  }
  return out;
}

function renderApiAffiliateCell(p: Provider): React.ReactNode {
  const api = (p as Provider & { apiAvailable?: boolean }).apiAvailable;
  const aff = (p as Provider & { affiliateProgramme?: boolean }).affiliateProgramme;

  const icons = `${api ? '🔌' : ''}${aff ? '🤝' : ''}`.trim();
  if (!icons) return null;

  return <span aria-label="API and affiliate availability">{icons}</span>;
}

function formatSpeed(value: unknown): string {
  if (value === 'fast') return 'Fast';
  if (value === 'medium') return 'Medium';
  if (value === 'slow') return 'Slow';
  if (value === 'varies') return 'Varies';
  return '';
}

function PromagenUsersCell({ usage }: { usage?: ReadonlyArray<PromagenUsersCountryUsage> }) {
  // Hard truth rules: show only what is true; if zero users, render empty cell.
  const cleaned = (usage ?? [])
    .filter(
      (u) =>
        Boolean(u) &&
        typeof u.countryCode === 'string' &&
        u.countryCode.trim().length === 2 &&
        typeof u.count === 'number' &&
        Number.isFinite(u.count) &&
        u.count > 0,
    )
    .map((u) => ({ countryCode: u.countryCode.trim().toUpperCase(), count: Math.floor(u.count) }))
    .sort((a, b) => b.count - a.count);

  if (cleaned.length === 0) {
    return null;
  }

  const top = cleaned.slice(0, 6);
  const remaining = Math.max(0, cleaned.length - top.length);

  // Fixed layout (2·2·2), but do not render empty slots.
  const rows = chunkPairs(top).filter((r) => r.length > 0);

  return (
    <div className="flex flex-col gap-1">
      {rows.map((pair, idx) => (
        <div key={`row-${idx}`} className="flex gap-3 whitespace-nowrap">
          {pair.map((c) => {
            const roman = toRomanNumeral(c.count);
            const aria = `${c.countryCode}: ${c.count} user${c.count === 1 ? '' : 's'}`;
            const title = `${c.count} user${c.count === 1 ? '' : 's'}`;

            return (
              <span
                key={`${c.countryCode}-${c.count}`}
                className="inline-flex items-center gap-1"
                title={title}
                aria-label={aria}
              >
                <Flag countryCode={c.countryCode} decorative />
                <span className="tabular-nums">{roman}</span>
              </span>
            );
          })}

          {/* Trailing “… +n” when more than 6 countries */}
          {idx === rows.length - 1 && remaining > 0 ? (
            <span
              className="text-slate-500"
              title={`${remaining} more countries`}
              aria-label={`${remaining} more countries`}
            >
              … +{remaining}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function ProvidersTable(props: ProvidersTableProps) {
  const { providers, limit, showRank } = props;

  const sliced =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? providers.slice(0, Math.floor(limit))
      : providers;

  const rows = sliced as ReadonlyArray<ProviderWithPromagenUsers>;

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
      <table className="min-w-full text-sm text-slate-200">
        <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 text-left">Provider</th>
            <th className="px-4 py-3 text-left">Promagen Users</th>
            <th className="px-4 py-3 text-left">Sweet Spot</th>
            <th className="px-4 py-3 text-left">Visual Styles</th>
            <th className="px-4 py-3 text-left">API &amp; Affiliate Programme</th>
            <th className="px-4 py-3 text-left">Generation Speed</th>
            <th className="px-4 py-3 text-left">Affordability</th>
            <th className="px-4 py-3 text-right">Score</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((p, idx) => {
            const score = typeof p.score === 'number' && Number.isFinite(p.score) ? p.score : null;
            const trend = p.trend;

            const trendGlyph =
              trend === 'up' ? (
                <span
                  className="text-emerald-400"
                  aria-label="Score trending up"
                  title="Trending up"
                >
                  ↑
                </span>
              ) : trend === 'down' ? (
                <span
                  className="text-rose-400"
                  aria-label="Score trending down"
                  title="Trending down"
                >
                  ↓
                </span>
              ) : trend === 'flat' ? (
                <span className="text-slate-400" aria-label="Score flat" title="Flat">
                  →
                </span>
              ) : null;

            const speed = formatSpeed(
              (p as Provider & { generationSpeed?: unknown }).generationSpeed,
            );
            const affordability = (p as Provider & { affordability?: string }).affordability;

            return (
              <tr key={p.id} className="border-t border-slate-800 hover:bg-slate-900/30">
                <td className="px-4 py-3 font-medium text-slate-50">
                  <div className="flex items-center gap-2">
                    {showRank ? (
                      <span className="text-slate-500 tabular-nums">{idx + 1}.</span>
                    ) : null}

                    {typeof (p as Provider & { icon?: string }).icon === 'string' &&
                    (p as Provider & { icon?: string }).icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(p as Provider & { icon?: string }).icon as string}
                        alt=""
                        width={18}
                        height={18}
                        loading="lazy"
                        className="h-[18px] w-[18px] rounded-sm"
                      />
                    ) : null}

                    {hasOutboundDestination(p) ? (
                      <a
                        href={buildGoHref(p.id, 'leaderboard')}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-slate-600 underline-offset-4 hover:decoration-slate-300"
                      >
                        {p.name}
                      </a>
                    ) : (
                      <span>{p.name}</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <PromagenUsersCell usage={p.promagenUsers} />
                </td>

                <td className="px-4 py-3">
                  {p.sweetSpot ? (
                    <span className="block line-clamp-2">{p.sweetSpot}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  {p.visualStyles ? (
                    <span className="block line-clamp-2">{p.visualStyles}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  {renderApiAffiliateCell(p) ?? <span className="text-slate-500">—</span>}
                </td>

                <td className="px-4 py-3">
                  {speed ? <span>{speed}</span> : <span className="text-slate-500">—</span>}
                </td>

                <td className="px-4 py-3">
                  {affordability ? (
                    <span className="block truncate">{affordability}</span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-right tabular-nums">
                  <span className="inline-flex items-center justify-end gap-2">
                    <span>{score !== null ? score : '—'}</span>
                    {trendGlyph}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
