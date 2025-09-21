import type { ProviderAdapter } from "./types";

export const stabilityAdapter: ProviderAdapter = {
  name: "stability",
  async image({ prompt, apiKey, model = "stable-diffusion-xl-1024-v1-0", size }) {
    const body: any = { text_prompts: [{ text: prompt }], cfg_scale: 7, steps: 30 };
    if (size) {
      const [w, h] = size.split("x").map(Number);
      if (Number.isFinite(w) && Number.isFinite(h)) Object.assign(body, { width: w, height: h });
    }
    const r = await fetch(`https://api.stability.ai/v1/generation/${model}/text-to-image`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Stability error ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const base64 = data?.artifacts?.[0]?.base64;
    if (!base64) throw new Error("No image data returned");
    return { url: `data:image/png;base64,${base64}` };
  },
};


