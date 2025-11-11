'use client';

import useAuth from '@/hooks/useAuth';
import { hasFeature } from '@/lib/plan';

export default function usePlan() {
  const { plan } = useAuth();
  return {
    plan,
    can: (bucket: 'fx' | 'homepage' | 'cosmic', feature: string) => hasFeature(bucket as any, feature, plan),
    isPaid: plan === 'paid',
  };
}
