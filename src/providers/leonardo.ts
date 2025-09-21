// src/providers/leonardo.ts
import { GenOptions, ProviderAdapter } from "./types";

const LEONARDO_API_KEY = process.env.LEONARDO_API_KEY ?? "";
const BASE = "https://cloud.leonardo.ai/api/rest/v1";

function sizeToWH(size?: GenOptions["size"]) {
  switch (size) {
    case "1024x1536": return { width: 1024, height: 1536 };
    case "1536x1024": return { width: 1536, height: 1024 };
    case "1024x1024": return { width: 1024, height: 1024 };
    case "auto":
    default: return {};
  }
}
function qualityFlags(q?: GenOptions["quality"]) {
  return q === "high" ? { highResolution: true } : {};
}

export const leonardoAdapter: ProviderAdapter = {
  name: "leonardo",
  async generateImages(opts: GenOptions): Promise<string[]> {
    if (!LEONARDO_API_KEY) throw new Error("Server missing LEONARDO_API_KEY");

    const { prompt, n = 1, model, quality = "auto", size } = opts;
    const capped = Math.max(1, Math.min(4, Number(n)));
    const body: Record<string, any> = {
      prompt,
      num_images: capped,
      ...sizeToWH(size),
      ...qualityFlags(quality),
    };
    if (model) body.modelId = model;

    // ===== Start request
    const startUrl = `${BASE}/generations`;
    console.log("🛰 [leonardo] POST", startUrl);
    console.log("🛰 [leonardo] headers", { Authorization: "Bearer ******", "Content-Type": "application/json" });
    console.log("🛰 [leonardo] body", JSON.stringify(body));

    const start = await fetch(startUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${LEONARDO_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const startText = await start.text();
    let startJson: any;
    try { startJson = JSON.parse(startText); } catch { startJson = { raw: startText }; }
    console.log("🛰 [leonardo] POST status", start.status, start.statusText);
    console.log("🛰 [leonardo] POST resp", JSON.stringify(startJson));

    if (!start.ok) throw new Error(startJson?.error?.message || startJson?.message || `Leonardo start error HTTP ${start.status}`);

    const genId =
      startJson?.sdGenerationJob?.generationId ||
      startJson?.generationId || startJson?.id || startJson?.generation?.id;

    if (!genId) throw new Error("Leonardo did not return a generationId");
    console.log("⏳ [leonardo]", genId, "queued");

    // ===== Poll loop
    const timeoutMs = 240_000, intervalMs = 2_000, deadline = Date.now() + timeoutMs;
    let lastStatus: string | undefined;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, intervalMs));
      const pollUrl = `${BASE}/generations/${genId}`;

      const poll = await fetch(pollUrl, { headers: { Authorization: `Bearer ${LEONARDO_API_KEY}` } });
      const pollText = await poll.text();
      let pollJson: any;
      try { pollJson = JSON.parse(pollText); } catch { pollJson = { raw: pollText }; }

      console.log("🛰 [leonardo] GET", pollUrl, "→", poll.status, poll.statusText);
      if (!poll.ok) {
        console.log("🛰 [leonardo] GET resp", JSON.stringify(pollJson));
        throw new Error(pollJson?.error?.message || pollJson?.message || `Leonardo poll error HTTP ${poll.status}`);
      }

      lastStatus = pollJson?.generation?.status || pollJson?.status || lastStatus;
      if (lastStatus) console.log(`[leonardo] ${genId} status → ${lastStatus}`);

      const imgs =
        pollJson?.generation?.generated_images ||
        pollJson?.generated_images ||
        pollJson?.images ||
        [];

      const urls: string[] = imgs.map((g: any) => g?.url || g?.image_path || g?.imageUrl || null).filter(Boolean);

      if (urls.length) {
        console.log(`✅ [leonardo] ready (${urls.length}) for ${genId}`);
        return urls.slice(0, capped);
      }

      if (lastStatus?.toUpperCase().includes("FAIL")) {
        console.log("🛑 [leonardo] poll fail", JSON.stringify(pollJson));
        throw new Error(`Leonardo generation failed (status=${lastStatus})`);
      }
    }

    throw new Error(`Leonardo generation timed out (last status=${lastStatus ?? "unknown"})`);
  },
};


