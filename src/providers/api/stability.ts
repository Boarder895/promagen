import { ImageProvider, GenInput, GenOutput } from "../types";
import fetch from "node-fetch";

export const stabilityProvider: ImageProvider = {
  name: "stability",
  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsModelSelect: true,

  async generate(input: GenInput): Promise<GenOutput> {
    try {
      const key = process.env.STABILITY_API_KEY;
      if (!key) return { ok: false, provider: "stability", code: "UNAUTHORIZED", message: "Missing STABILITY_API_KEY" };

      const model = input.model ?? "stable-diffusion-xl-1024-v1-0";
      const w = input.width ?? 1024, h = input.height ?? 1024;

      const body = {
        text_prompts: [
          { text: input.prompt, weight: 1 },
          ...(input.negativePrompt ? [{ text: input.negativePrompt, weight: -1 }] : [])
        ],
        cfg_scale: input.guidance ?? 7,
        steps: input.steps ?? 30,
        width: w, height: h,
        seed: typeof input.seed === "number" ? input.seed : undefined,
      };

      const r = await fetch(`https://api.stability.ai/v1/generation/${model}/text-to-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify(body)
      });

      const raw = await r.json().catch(() => ({}));
      if (!r.ok) {
        const code = r.status === 401 ? "UNAUTHORIZED" :
                     r.status === 429 ? "RATE_LIMIT" :
                     r.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST";
        return { ok: false, provider: "stability", code, message: raw?.message ?? `HTTP ${r.status}`, raw };
      }

      const urls = (raw?.artifacts ?? [])
        .filter((a: any) => a.base64)
        .map((a: any) => `data:image/png;base64,${a.base64}`);

      return { ok: true, provider: "stability", imageUrls: urls, model, raw };
    } catch (err: any) {
      return { ok: false, provider: "stability", code: "UNKNOWN", message: err?.message ?? "Unknown error", raw: err };
    }
  }
};


