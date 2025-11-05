'use client';

/**
 * The source util returns a list typed as Exchange[] in your project,
 * but the UI needs additional fields (code, open, temp, localtime).
 * Until the source type is refined, consume it as a UI shape with optional fields.
 */
import { exchangesUI } from '@/lib/exchanges-ui';

type ExchangeUI = {
  id: string;
  city?: string;
  code?: string;
  open?: boolean;
  temp?: number;
  localtime?: string;
};

export default function StockRibbon() {
  const rows = exchangesUI() as unknown as ExchangeUI[];

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {rows.map((e) => (
        <div key={e.id} className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
          <span className="font-semibold">{e.code ?? e.id}</span>{' '}
          <span className="opacity-70">• {e.city ?? ''}</span>{' '}
          <span>• {e.open ? 'Open' : 'Closed'}</span>{' '}
          <span className="opacity-70">{typeof e.temp === 'number' ? `${e.temp}°` : ''}</span>{' '}
          <span className="opacity-70">{e.localtime ? `• ${e.localtime}` : ''}</span>
        </div>
      ))}
    </div>
  );
}

