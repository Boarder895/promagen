"use client";

import React from "react";

export type Preset = {
  id: string;
  title: string;
  prompt: string;
  negativePrompt?: string;
  provider?: string;  // required by callers
  model?: string;
};

const DEFAULTS: Preset[] = [
  {
    id: "p1",
    title: "Photoreal Character",
    prompt: "semi-realistic cartoon character, cinematic lighting, crisp details",
    provider: "openai",
    model: "dalle-latest",
  },
  {
    id: "p2",
    title: "Ultra Photoreal Background",
    prompt: "ultra-photorealistic environment, dynamic lighting, high detail",
    provider: "stability",
    model: "sdxl",
  },
];

export default function PromptPresetPicker({
  onSelect,
  presets,
}: {
  onSelect?: (preset: Preset) => void;
  presets?: Preset[];
}) {
  const items = presets?.length ? presets : DEFAULTS;
  return (
    <div className="space-y-2">
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          className="w-full text-left border rounded-md p-2 hover:bg-gray-50"
          onClick={() => onSelect?.(p)}
        >
          <div className="font-medium">{p.title}</div>
          <div className="text-xs opacity-70">
            {p.provider ?? "provider: n/a"}{p.model ? ` ï¿½ ${p.model}` : ""}
          </div>
          <div className="text-sm mt-1 line-clamp-2">{p.prompt}</div>
        </button>
      ))}
    </div>
  );
}




