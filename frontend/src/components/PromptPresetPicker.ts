// src/components/PromptPresetPicker.tsx
"use client";

import { useState } from "react";
import type { Preset } from "@/lib/presets";
import { Presets } from "@/lib/presets";

export default function PromptPresetPicker({
  onSubmit,
}: {
  onSubmit: (payload: any) => void;
}) {
  const [presetId, setPresetId] = useState(Presets[0].id);
  const [prompt, setPrompt] = useState("");

  const preset = Presets.find((p) => p.id === presetId)!;

  function handleGenerate() {
    const payload = {
      presetId: preset.id,
      provider: preset.provider,
      model: preset.model,
      ...preset.defaults,
      prompt,
    };
    onSubmit(payload);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Preset</label>
      <select
        value={presetId}
        onChange={(e) => setPresetId(e.target.value)}
        className="w-64 rounded border px-2 py-1 text-sm"
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
        rows={5}
        className="w-full max-w-xl rounded border p-2 text-sm"
        placeholder="Write your instruction…"
      />

      <div>
        <button
          type="button"
          onClick={handleGenerate}
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-black"
        >
          Generate
        </button>
      </div>
    </div>
  );
}
