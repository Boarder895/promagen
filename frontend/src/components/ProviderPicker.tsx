"use client";

import React, { useState } from "react";
import {
  PROVIDER_IDS,
  PROVIDER_MAP,
  type ProviderKey,
} from "@/lib/providers";

export default function ProviderPicker({
  selected: initial,
  onChange,
}: {
  selected?: ProviderKey[];
  onChange?: (ids: ProviderKey[]) => void;
}) {
  const [selected, setSelected] = useState<Set<ProviderKey>>(
    new Set(initial ?? PROVIDER_IDS) // default: all
  );

  function toggle(id: ProviderKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      onChange?.([...next]);
      return next;
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PROVIDER_IDS.map((id) => (
        <label key={id} className="inline-flex items-center gap-2 border rounded px-2 py-1">
          <input
            type="checkbox"
            checked={selected.has(id)}
            onChange={() => toggle(id)}
          />
          <span>{PROVIDER_MAP[id].name}</span>
        </label>
      ))}
    </div>
  );
}

