// src/providers/openai.ts
import { GenOptions, ProviderAdapter } from "./types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

const ALLOWED_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
const ALLOWED_QUALITIES = new Set(["low", "medium", "high", "auto"]);

export const openaiAdapter: ProviderAdapter = {
  name: "openai",
  async generateImages(opts: GenOptions): Promise<string[]> {
    if (!OPENAI_API_KEY) throw new Error("Server missing OPENAI_API_KEY");

    let { prompt, size = "1024x1024", n = 1, model = "gpt-image-1", quality = "medium" } = opts;

    n = Number.isFinite(n) ? Math.max(1, Math.min(4, Number(n))) : 1;
    if (!ALLOWED_SIZES.has(String(size))) size = "1024x1024";
    if (!ALLOWED_QUALITIES.has(String(quality))) quality = "medium";

    const body: Record<string, any> = { model, prompt, n };
    if (size !== "auto") body.size = size;
    if (quality !== "auto") body.quality = quality;

    console.log("🔎 [openai] body:", JSON.stringify(body));

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("❌ [openai] error:", JSON.stringify(data, null, 2));
      throw new Error(data?.error?.message || "OpenAI error");
    }

    const items: string[] = (data.data ?? [])
      .map((d: any) => d?.url || (d?.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
      .filter(Boolean);

    if (!items.length) throw new Error("OpenAI returned no images");
    return items;
  },
};
