"use client";

import { useState } from "react";
import { PROVIDERS, type ProviderKey } from "@/lib/providers";
import { runAcrossProviders } from "@/lib/runAcrossProviders";
import type { Prompt } from "@/hooks/usePrompts";

export function ProviderPicker({ prompt }: { prompt: Prompt }) {
  const [selected, setSelected] = useState<Set<ProviderKey>>(new Set(PROVIDERS.map((p) => p.key)));

  function toggle(key: ProviderKey) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function run() {
    await runAcrossProviders(prompt, Array.from(selected));
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PROVIDERS.map((p) => (
          <label key={p.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
            <span>{p.name}</span>
          </label>
        ))}
      </div>

      <button
        className="mt-4 px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
        onClick={run}
        type="button"
      >
        Run across providers
      </button>
    </div>
  );
}
