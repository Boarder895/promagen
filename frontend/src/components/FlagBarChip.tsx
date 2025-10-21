import React from "react";
import { flagEmoji } from "@/lib/flags";

type Props = {
  cc: string;         // ISO country code ("GB")
  users: number;      // count for this country
  maxUsers: number;   // max users among the set (for scale)
  name?: string;      // readable name (aria/tooltip)
  width?: number;     // bar width (px)
  height?: number;    // bar height (px)
};

export default function FlagBarChip({ cc, users, maxUsers, name, width = 68, height = 8 }: Props) {
  const pct = maxUsers > 0 ? Math.max(0, Math.min(1, users / maxUsers)) : 0;
  const barW = Math.max(2, Math.round(width * pct));
  const label = `${name || cc}: ${users} users`;

  return (
    <span className="chip" title={label} role="group" aria-label={label}>
      <span className="flag" role="img" aria-label={name || cc}>{flagEmoji(cc)}</span>
      <svg className="bar" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <rect x="0" y="0" width={width} height={height} rx={height / 2} fill="rgba(255,255,255,.08)" />
        <rect x="0" y="0" width={barW} height={height} rx={height / 2} />
      </svg>
      <b className="n">{users}</b>
      <style jsx>{`
        .chip{display:inline-flex;align-items:center;gap:.45rem;padding:.25rem .55rem;border:1px solid rgba(255,255,255,.08);
          border-radius:.75rem;background:rgba(255,255,255,.03);line-height:1;font-size:.85rem;font-variant-numeric:tabular-nums}
        .flag{font-size:1.1rem}.bar{display:inline-block}.n{font-weight:700}
      `}</style>
    </span>
  );
}





