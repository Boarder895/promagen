"use client";

import React from "react";
import { PROVIDER_IDS } from "@/lib/providers";
import type { ProviderId } from "@/lib/providers";

type Props = {
  value?: ProviderId;
  onChange?: (id: ProviderId) => void;
  label?: string;
};

export default function ProviderPicker({ value, onChange, label = "Provider" }: Props) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        className="mt-1 block w-full border rounded px-2 py-1 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value as ProviderId)}
      >
        <option value="" disabled>
          Select…
        </option>
        {PROVIDER_IDS.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </label>
  );
}


