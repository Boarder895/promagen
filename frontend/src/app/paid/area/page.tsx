'use client';

import useAuth from '@/hooks/useAuth';
import CosmicOverlay from '@/components/cosmic/cosmic-overlay';
import PlanSelector from '@/components/account/plan-selector';

export default function PaidArea() {
  const { user, plan } = useAuth();

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-lg font-semibold">Paid Area</h1>
      <p className="text-sm text-white/80">Hello, {user?.email ?? user?.id ?? 'guest'} · Plan: {plan.toUpperCase()}</p>
      <PlanSelector />
      <CosmicOverlay />
      <p className="text-sm text-white/70">This space showcases paid-only widgets and overlays.</p>
    </main>
  );
}
