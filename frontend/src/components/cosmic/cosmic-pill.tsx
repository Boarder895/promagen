'use client';

import usePlan from '@/hooks/usePlan';

export default function CosmicPill() {
  const { isPaid } = usePlan();
  return (
    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
      Cosmic {isPaid ? 'ON' : 'OFF'}
    </span>
  );
}
