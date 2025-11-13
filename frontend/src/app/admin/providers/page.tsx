import React from "react";
import { getProviders, type ProvidersApiResponse } from "@/lib/providers/api";
import ProvidersTable from "@/components/providers/providers-table";

/** Simple admin surface with strict props and no `any`. */
export default function AdminProvidersPage(): JSX.Element {
  const data: ProvidersApiResponse = getProviders(10_000);

  return (
    <main aria-label="providers admin" className="p-6">
      <section className="mt-6">
        <ProvidersTable providers={data} title="All Providers (admin)" caption="Full list" />
      </section>
    </main>
  );
}
