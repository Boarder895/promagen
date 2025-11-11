"use client";

import React from "react";
import { getProviders, type ProvidersApiResponse } from "@/lib/providers/api";

export default function AdminProvidersPage() {
  const [json, setJson] = React.useState<ProvidersApiResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await getProviders(10_000);
        if (active) {
          setJson(data);
          setError(null);
        }
      } catch (e) {
        if (active) setError("Failed to load providers");
        console.error("[admin/providers] fetch failed", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8" aria-labelledby="admin-providers-heading">
      <h1 id="admin-providers-heading" className="text-xl font-semibold">
        Admin ▸ Providers
      </h1>

      {loading && (
        <p className="mt-4 text-sm text-black/60 dark:text-white/70" aria-live="polite" data-testid="admin-providers-loading">
          Loading…
        </p>
      )}

      {error && (
        <p className="mt-4 text-red-500" role="alert" data-testid="admin-providers-error">
          {error}
        </p>
      )}

      {!loading && json && (
        <section aria-label="Providers JSON" className="mt-6">
          <div className="mb-2 text-sm text-black/60 dark:text-white/70">
            <span className="mr-2">Count: {json.count}</span>
            <span className="mr-2">OK: {String(json.ok)}</span>
            <span className="mr-2">Mode: {json.mode ?? "live"}</span>
            <span>As of: {new Date(json.ts).toLocaleString()}</span>
          </div>

          <pre
            className="overflow-auto rounded-xl bg-black/5 p-4 text-xs leading-6 dark:bg-white/10"
            data-testid="admin-providers-json"
          >
{JSON.stringify(json, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
