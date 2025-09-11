import { ImageProvider, GenInput, GenOutput } from "../types";
import fetch from "node-fetch";

export const deepaiProvider: ImageProvider = {
  name: "deepai",
  supportsNegative: false,
  supportsSeed: false,
  supportsSize: false,
  supportsModelSelect: false,

  async generate(input: GenInput): Promise<GenOutput> {
    try {
      const key = process.env.DEEPAI_API_KEY;
      if (!key) return { ok: false, provider: "deepai", code: "UNAUTHORIZED", message: "Missing DEEPAI_API_KEY" };

      const form = new URLSearchParams();
      form.set("text", input.prompt);

      const r = await fetch("https://api.deepai.org/api/text2img", {
        method: "POST",
        headers: { "api-key": key, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });

      const raw = await r.json().catch(() => ({}));
      if (!r.ok) {
        const code = r.status === 401 ? "UNAUTHORIZED" :
                     r.status === 429 ? "RATE_LIMIT" :
                     r.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST";
        return { ok: false, provider: "deepai", code, message: raw?.status ?? `HTTP ${r.status}`, raw };
      }

      const url = raw?.output_url;
      return url
        ? { ok: true, provider: "deepai", imageUrls: [url], raw }
        : { ok: false, provider: "deepai", code: "UNKNOWN", message: "No output_url in response", raw };
    } catch (err: any) {
      return { ok: false, provider: "deepai", code: "UNKNOWN", message: err?.message ?? "Unknown error", raw: err };
    }
  }
};
