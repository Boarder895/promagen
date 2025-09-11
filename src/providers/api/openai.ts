import { ImageProvider, GenInput, GenOutput } from "../types";
import fetch from "node-fetch";

export const openaiProvider: ImageProvider = {
  name: "openai",
  supportsNegative: false,
  supportsSeed: false,
  supportsSize: true,
  supportsModelSelect: true,

  async generate(input: GenInput): Promise<GenOutput> {
    try {
      const key = process.env.OPENAI_API_KEY;
      if (!key) {
        return {
          ok: false,
          provider: "openai",
          code: "UNAUTHORIZED",
          message: "Missing OPENAI_API_KEY"
        };
      }

      const w = input.width ?? 1024;
      const h = input.height ?? 1024;
      const size = `${w}x${h}`;
      const model = input.model ?? "gpt-image-1";

      // Optional Project header
      const projectId = process.env.OPENAI_PROJECT_ID;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      };
      if (projectId) {
        headers["OpenAI-Project"] = projectId;
      }

      const r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt: input.prompt,
          n: 1,
          size,
          model
        })
      });

      const raw = await r.json().catch(() => ({}));
      if (!r.ok) {
        const code =
          r.status === 401 ? "UNAUTHORIZED" :
          r.status === 429 ? "RATE_LIMIT" :
          r.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST";
        return {
          ok: false,
          provider: "openai",
          code,
          message: raw?.error?.message ?? `HTTP ${r.status}`,
          raw
        };
      }

      const urls = (raw?.data ?? [])
        .map((d: any) => d.url)
        .filter(Boolean);

      return {
        ok: true,
        provider: "openai",
        imageUrls: urls,
        model,
        raw
      };
    } catch (err: any) {
      return {
        ok: false,
        provider: "openai",
        code: "UNKNOWN",
        message: err?.message ?? "Unknown error",
        raw: err
      };
    }
  }
};
