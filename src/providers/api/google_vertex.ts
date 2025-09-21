import { ImageProvider, GenInput, GenOutput } from "../types";
import { GoogleAuth } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/cloud-platform"];

async function getAccessToken() {
  const auth = new GoogleAuth({ scopes: SCOPES });
  const client = await auth.getClient();
  return await client.getAccessToken();
}

export const googleVertexProvider: ImageProvider = {
  name: "google",
  supportsNegative: true,
  supportsSeed: true,
  supportsSize: true,
  supportsModelSelect: true,

  async generate(input: GenInput): Promise<GenOutput> {
    const project = process.env.GOOGLE_PROJECT_ID;
    const location = process.env.GOOGLE_LOCATION || "us-central1";
    const model = input.model ?? process.env.GOOGLE_VERTEX_MODEL ?? "imagegeneration@005";
    if (!project) return { ok: false, provider: "google", code: "NOT_CONFIGURED", message: "Missing GOOGLE_PROJECT_ID" };

    try {
      const token = await getAccessToken();
      if (!token) return { ok: false, provider: "google", code: "UNAUTHORIZED", message: "No Google access token" };

      const body = {
        instances: [{
          prompt: input.prompt,
          negative_prompt: input.negativePrompt,
        }],
        parameters: {
          sampleCount: 1,
          steps: input.steps ?? 30,
          guidanceScale: input.guidance ?? 7,
          seed: typeof input.seed === "number" ? input.seed : undefined,
          width: input.width ?? 1024,
          height: input.height ?? 1024,
        }
      };

      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${encodeURIComponent(model)}:predict`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const raw = await r.json().catch(() => ({}));

      if (!r.ok) {
        const code = r.status === 401 ? "UNAUTHORIZED" :
                     r.status === 429 ? "RATE_LIMIT" :
                     r.status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST";
        return { ok: false, provider: "google", code, message: raw?.error?.message ?? `HTTP ${r.status}`, raw };
      }

      const b64 = raw?.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) return { ok: false, provider: "google", code: "UNKNOWN", message: "No image bytes in response", raw };

      return { ok: true, provider: "google", imageUrls: [`data:image/png;base64,${b64}`], model, raw };
    } catch (err: any) {
      return { ok: false, provider: "google", code: "UNKNOWN", message: err?.message ?? "Unknown error", raw: err };
    }
  }
};


