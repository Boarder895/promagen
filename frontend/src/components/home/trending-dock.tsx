'use client';

import TrendingTable from '@/components/ux/trending-table';

export default function TrendingDock() {
  return (
    <div className="absolute right-6 top-24 w-[420px]">
      <TrendingTable />
    </div>
  );
}

