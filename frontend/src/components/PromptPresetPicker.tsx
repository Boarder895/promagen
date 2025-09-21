// src/components/PromptPresetPicker.tsx
"use client";

import { useState } from "react";
import type { Preset } from "@/lib/presets";
import { Presets } from "@/lib/presets";

/**
 * Simple preset-and-prompt form.
 * Calls onSubmit with a payload ready for your chat/send handler.
 */
export default function PromptPresetPicker({
  onSubmit
}: {
  onSubmit: (payload: any) => void;
}) {
  // pick first preset by default
  const [presetId, setPresetId] = useState<string>(Presets[0]?.id ?? "");
  const [prompt, setPrompt] = useState<string>("");

  const preset: Preset | undefined = Presets.find((p) => p.id === presetId);

  function handleGenerate() {
    if (!preset) return;

    const payload = {
      presetId: preset.id,
      provider: preset.provider,
      model: preset.model,
      ...preset.defaults,
      prompt
    };

    onSubmit(payload);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Preset</label>
      <select
        value={presetId}
        onChange={(e) => setPresetId(e.target.value)}
        className="w-full rounded border px-2 py-1"
      >
        {Presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <label className="block text-sm font-medium">Prompt</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={6}
        className="w-full rounded border px-2 py-1"
        placeholder="Type your prompt…"
      />

      <button
        type="button"
        onClick={handleGenerate}
        className="rounded bg-black px-3 py-1 text-white hover:bg-gray-800"
      >
        Generate
      </button>
    </div>
  );
}
