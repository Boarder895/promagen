"use client";

import React, { useMemo, useState } from "react";
import PROVIDERS, { type Provider } from "@/lib/providers"; // <- default import

export default function CompareRunner({ showAll = false }: { showAll?: boolean }) {
  const [selection, setSelection] = useState<string[]>([]);

  const providers = useMemo<Provider[]>(
    () => (showAll ? PROVIDERS : PROVIDERS.filter((p) => p.api)),
    [showAll]
  );

  function toggle(id: string) {
    setSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <section className="p-4 border rounded-xl">
      <h3 className="font-semibold mb-3">Compare Providers</h3>
      <div className="grid md:grid-cols-2 gap-2">
        {providers.map((p) => (
          <label key={p.id} className="flex items-center gap-2 border rounded-md p-2">
            <input
              type="checkbox"
              checked={selection.includes(p.id)}
              onChange={() => toggle(p.id)}
            />
            <span className="font-medium">{p.name}</span>
            <span className="text-xs opacity-70 ml-auto">{p.api ? "API" : "Manual"}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 text-sm opacity-80">
        Selected: {selection.length ? selection.join(", ") : "none"}
      </div>
    </section>
  );
}
