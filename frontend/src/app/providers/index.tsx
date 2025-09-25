import React from "react";
import ProviderGrid from "@/components/ProviderGrid";

export const revalidate = 60;

export default function ProvidersIndex() {
  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Providers</h1>
      {/* Use `kind`, legacy `filter` is also supported by the component */}
      <ProviderGrid kind="all" />
    </main>
  );
}
