'use client';

import { usePlan } from '@/hooks/user-plan';

export default function CosmicPill() {
  const { plan } = usePlan();
  const isPaid = plan !== 'free';

  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
      <span className="font-medium">Cosmic</span>
      <span className="text-neutral-600">{isPaid ? 'Pro features enabled' : 'Free mode'}</span>
    </div>
  );
}
