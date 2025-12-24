// C:\Users\Proma\Projects\promagen\frontend\src\app\admin\providers\page.tsx

import React from 'react';

import ProvidersTable from '@/components/providers/providers-table';
import { getProvidersWithPromagenUsers, type ProvidersApiResponse } from '@/lib/providers/api';

/** Simple admin surface with strict props and no `any`. */
export const revalidate = 60;

export default async function AdminProvidersPage(): Promise<JSX.Element> {
  // Admin wants the full list. This stays cheap in practice because provider count is small,
  // and Promagen Users enrichment is guarded by freshness checks (blank if stale/unavailable).
  const data: ProvidersApiResponse = await getProvidersWithPromagenUsers(10_000);

  return (
    <main aria-label="providers admin" className="p-6">
      <section className="mt-6">
        <ProvidersTable providers={data} title="All Providers (admin)" caption="Full list" />
      </section>
    </main>
  );
}
