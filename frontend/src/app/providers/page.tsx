import React from "react";
import { fetchProviders } from "@/lib/api";
import type { Provider } from "@/lib/providers";

export const revalidate = 60;

export default async function ProvidersPage() {
  const providers: Provider[] = await fetchProviders();

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Providers</h1>
      <div className="grid grid-cols-12 gap-2 font-medium border-b pb-2">
        <div className="col-span-4">Name</div>
        <div className="col-span-3">ID</div>
        <div className="col-span-2">API</div>
        <div className="col-span-3">Affiliate</div>
      </div>

      {providers.map((p) => (
        <div key={p.id} className="grid grid-cols-12 gap-2 py-2 border-b">
          <div className="col-span-4">{p.name}</div>
          <div className="col-span-3">{p.id}</div>
          <div className="col-span-2">{p.api ? "Yes" : "No"}</div>
          <div className="col-span-3">{p.affiliate ? "Yes" : "No"}</div>
        </div>
      ))}
    </main>
  );
}
