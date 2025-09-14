import { useState } from "react";
import type { Preset } from "@/lib/presets";
import { Presets } from "@/lib/presets"; // mirror from server or fetch via API

export default function PromptPresetPicker({ onSubmit }:{
  onSubmit: (payload: any) => void
}) {
  const [presetId, setPresetId] = useState(Presets[0].id);
  const [prompt, setPrompt] = useState("");

  const preset = Presets.find(p => p.id === presetId)!;

  function handleGenerate() {
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
    <div>
      <label>Preset</label>
      <select value={presetId} onChange={e=>setPresetId(e.target.value)}>
        {Presets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>

      <label>Prompt</label>
      <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} />

      <button onClick={handleGenerate}>Generate</button>
    </div>
  );
}
