// src/routes/openai.ts — chat + image generation (credits OFF)
import { Router } from "express";

const router = Router();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
if (!OPENAI_API_KEY) console.error("❌ Missing OPENAI_API_KEY");

function requireKey() {
  if (!OPENAI_API_KEY) {
    const err: any = new Error("Server missing OPENAI_API_KEY");
    err.status = 500;
    throw err;
  }
}

const ALLOWED_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
const ALLOWED_QUALITIES = new Set(["low", "medium", "high", "auto"]);

// Chat sanity
router.post("/chat", async (req, res) => {
  try {
    requireKey();
    const { model = "gpt-4o-mini", temperature = 0.2, messages = [] } = req.body ?? {};
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature, messages }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data.error ?? data });
    const text = data.choices?.[0]?.message?.content ?? "";
    res.json({ ok: true, model, text });
  } catch (e: any) {
    res.status(e.status ?? 500).json({ ok: false, error: e.message ?? "Unknown" });
  }
});

// Images — supports url OR b64_json responses
router.post("/images", async (req, res) => {
  try {
    requireKey();
    let { prompt, size = "1024x1024", n = 1, model = "gpt-image-1", quality = "medium" } = req.body ?? {};
    if (!prompt || typeof prompt !== "string") return res.status(400).json({ ok: false, error: "Missing prompt" });

    n = Number.isFinite(n) ? Math.max(1, Math.min(4, Number(n))) : 1;
    if (!ALLOWED_SIZES.has(String(size))) size = "1024x1024";
    if (!ALLOWED_QUALITIES.has(String(quality))) quality = "medium";

    const body: Record<string, any> = { model, prompt, n };
    if (size !== "auto") body.size = size;
    if (quality !== "auto") body.quality = quality;

    console.log("🔎 OpenAI /images/generations body:", JSON.stringify(body));

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("❌ OpenAI image error:", JSON.stringify(data, null, 2));
      return res.status(r.status).json({ ok: false, error: data.error ?? data });
    }

    const items: string[] = (data.data ?? [])
      .map((d: any) => d?.url || (d?.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
      .filter(Boolean);

    if (!items.length) return res.status(502).json({ ok: false, error: "No image returned" });
    res.json({ ok: true, dataUrls: items });
  } catch (e: any) {
    res.status(e.status ?? 500).json({ ok: false, error: e.message ?? "Unknown" });
  }
});

export default router;

