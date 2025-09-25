// src/components/RunAcrossProvidersButton.tsx
"use client";
import { openAllProviders } from "@/lib/openAllProviders";

export default function RunAcrossProvidersButton({ prompt }: { prompt: string }) {
  return (
    <button
      onClick={() => openAllProviders(prompt, { src: "prompt-detail" })}
      className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
      title="Opens tabs for all 20 providers and copies the prompt"
    >
      Run across providers
    </button>
  );
}
