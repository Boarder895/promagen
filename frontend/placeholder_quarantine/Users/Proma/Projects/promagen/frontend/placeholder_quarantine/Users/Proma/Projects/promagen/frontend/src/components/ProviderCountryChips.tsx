import React, { useCallback, useEffect, useState } from 'react';

import FlagBarChip from './FlagBarChip';

type Row = { country_cc: string; users: number };

function nameOf(cc: string) {
  try {
    const dn = new (Intl as any).DisplayNames(['en-GB'], { type: 'region' });
    if (!cc || cc === 'ZZ') return 'Unknown';
    return dn.of(cc) || cc;
  } catch {
    return cc || 'Unknown';
  }
}

export default function ProviderCountryChips({ providerId }: { providerId: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/live/geo/provider?providerId=${providerId}`);
    const j = await r.json();
    if (!j?.ok) return;
    const list: Row[] = j.data || [];
    setRows(list.slice(0, 6)); // top 6
  }, [providerId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await load();
    })();

    const t = setInterval(() => {
      if (!cancelled) void load();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [load]);

  if (!rows.length) return null;

  const maxUsers = Math.max(...rows.map((r) => r.users));

  return (
    <div className="wrap" aria-label="Top countries for this platform">
      {rows.map((r) => (
        <FlagBarChip
          key={r.country_cc}
          cc={r.country_cc || 'ZZ'}
          users={r.users}
          maxUsers={maxUsers}
          name={nameOf(r.country_cc)}
        />
      ))}
      <style jsx>{`
        .wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.25rem;
        }
      `}</style>
    </div>
  );
}
