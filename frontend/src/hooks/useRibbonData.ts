'use client';
import useSWR from 'swr';
import type { MarketStatus } from '@/lib/market/types';

const fetcher = (url: string) => fetch(url).then(r => r.json() as Promise<MarketStatus[]>);

export function useRibbonData() {
  const { data, error, isLoading } = useSWR<MarketStatus[]>('/api/ribbon', fetcher, {
    refreshInterval: 60_000, // heartbeat feel (60s)
  });
  return { data: data ?? [], error, isLoading };
}

