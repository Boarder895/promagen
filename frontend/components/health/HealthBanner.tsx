'use client';

import { useHealth } from './HealthContext';

export default function HealthBanner() {
  const health = useHealth();
  const bg =
    health.status === 'up'
      ? 'bg-green-100 text-green-900'
      : health.status === 'down'
        ? 'bg-red-100 text-red-900'
        : 'bg-gray-100 text-gray-800';

  return (
    <div className={`${bg} rounded-xl px-4 py-3 text-sm flex items-center justify-between`}>
      <span className="font-medium">API: {health.status.toUpperCase()}</span>
      <span className="opacity-75">Frontend → API: {health.apiBase}</span>
    </div>
  );
}
