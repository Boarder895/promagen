// components/health/HealthBanner.tsx
'use client';

import { useHealth } from './HealthContext';

export default function HealthBanner() {
  const health = useHealth();

  // show only when NOT ok
  if (health.status === 'ok') return null;

  const label = health.status === 'degraded' ? 'Degraded performance' : 'Service unavailable';

  return (
    <div className="rounded-lg border bg-amber-50 text-amber-900 px-3 py-2 text-sm">
      <div className="font-medium">{label}</div>
      <div className="opacity-80">
        Frontend → API: <code>{health.apiBase ?? 'unknown'}</code>
      </div>
      {health.message ? <div className="opacity-70">{health.message}</div> : null}
    </div>
  );
}
