import * as React from 'react';
import { Badge } from '@/components/ui/badge';

export type BestRightNowBadgeProps = {
  /** When the current Ã¢â‚¬Å“bestÃ¢â‚¬Â window ends */
  until?: string | number | Date;
  /** Alias kept for callers using this name */
  regionCloseIso?: string;
  /** Optional text before the timer */
  label?: string;
  /** Optional affiliate link for the leader */
  href?: string;
};

const toMs = (v: string | number | Date) =>
  v instanceof Date ? v.getTime() : typeof v === 'number' ? v : new Date(v).getTime();

const fmtHHMM = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

export const BestRightNowBadge: React.FC<BestRightNowBadgeProps> = ({
  until,
  regionCloseIso,
  label,
  href,
}) => {
  const target = until ?? regionCloseIso;
  const ms = target ? Math.max(0, toMs(target) - Date.now()) : 0;
  const text = target ? fmtHHMM(ms) : '';

  const inner = (
    <Badge variant="success" className="gap-1">
      <span className="font-semibold">Best right now</span>
      {text && <span className="opacity-90">Ã‚Â· {label ?? 'ends in'} {text}</span>}
    </Badge>
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-block">
      {inner}
    </a>
  ) : (
    inner
  );
};

