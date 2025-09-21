import { ImageProvider, GenInput, GenOutput } from "../types";
import fetch from "node-fetch";

export const leonardoProvider: ImageProvider = {
  name: "leonardo",
  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsModelSelect: true,

  async generate(input: GenInput): Promise<GenOutput> {
    const key = process.env.LEONARDO_API_KEY;
    if (!key) return { ok: false, provider: "leonardo", code: "UNAUTHORIZED", message: "Missing LEONARDO_API_KEY" };

    const modelId = input.model ?? "LEONARDO_DIFFUSION_XL";
    const w = input.width ?? 1024, h = input.height ?? 1024;

    try {
      const create = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          prompt: input.prompt,
          negative_prompt: input.negativePrompt,
          width: w, height: h,
          num_images: 1,
          steps: input.steps ?? 30,
          guidance: input.guidance ?? 7,
          modelId,
          seed: typeof input.seed === "number" ? input.seed : undefined,
        })
      });
      const created = await create.json().catch(() => ({}));
      if (!create.ok) {
        const code = create.status === 401 ? "UNAUTHORIZED" :
                     create.status === 429 ? "RATE_LIMIT" :
                     create.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST";
        return { ok: false, provider: "leonardo", code, message: created?.message ?? `HTTP ${create.status}`, raw: created };
      }

      const genId = created?.sdGenerationJob?.generationId || created?.generationId;
      if (!genId) return { ok: false, provider: "leonardo", code: "UNKNOWN", message: "Missing generationId", raw: created };

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        const poll = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${genId}`, {
          headers: { "Authorization": `Bearer ${key}` }
        });
        const raw = await poll.json().catch(() => ({}));

        const urls = raw?.generations_by_pk?.generated_images?.map((g: any) => g?.url)?.filter(Boolean);
        if (urls?.length) return { ok: true, provider: "leonardo", imageUrls: urls, model: modelId, raw };

        if (raw?.generations_by_pk?.status === "FAILED") {
          return { ok: false, provider: "leonardo", code: "SERVER_ERROR", message: "Generation failed", raw };
        }
      }
      return { ok: false, provider: "leonardo", code: "TIMEOUT", message: "Timed out waiting for generation" };
    } catch (err: any) {
      return { ok: false, provider: "leonardo", code: "UNKNOWN", message: err?.message ?? "Unknown error", raw: err };
    }
  }
};


