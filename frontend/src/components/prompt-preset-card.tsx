"use client";

import React from "react";

export type Preset = {
  id: string;
  title: string;
  prompt: string;
  negativePrompt?: string;
  provider?: string;       // <- add provider so consuming code compiles
  model?: string;
};

export default function PromptPresetCard({
  preset,
  onSelect,
}: {
  preset: Preset;
  onSelect?: (p: Preset) => void;
}) {
  return (
    <button
      type="button"
      className="w-full text-left border rounded-md p-3 hover:bg-gray-50"
      onClick={() => onSelect?.(preset)}
    >
      <div className="font-semibold">{preset.title}</div>
      <div className="text-xs opacity-70">
        {preset.provider ?? "provider: n/a"}{preset.model ? ` · ${preset.model}` : ""}
      </div>
      <div className="text-sm mt-1 line-clamp-2">{preset.prompt}</div>
    </button>
  );
}









