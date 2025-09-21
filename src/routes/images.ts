// src/routes/images.ts
import { Router } from "express";
import { GenOptions, ProviderAdapter } from "../providers/types";
import { openaiAdapter } from "../providers/openai";
import { leonardoAdapter } from "../providers/leonardo";

const router = Router();

// Register providers here
const providers: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  leonardo: leonardoAdapter,
};

router.post("/:provider/images", async (req, res) => {
  try {
    const provKey = String(req.params.provider || "").toLowerCase();
    const provider = providers[provKey];
    if (!provider) return res.status(400).json({ ok: false, error: `Unknown provider '${provKey}'` });

    const { prompt, size, n, model, quality } = (req.body ?? {}) as GenOptions;
    if (!prompt || typeof prompt !== "string") return res.status(400).json({ ok: false, error: "Missing prompt" });

    console.log(`➡️ provider=${provKey}, model=${model ?? "(default)"}, size=${size ?? "(auto)"}, n=${n ?? 1}, quality=${quality ?? "auto"}`);

    const urls = await provider.generateImages({ prompt, size, n, model, quality });
    return res.json({ ok: true, dataUrls: urls });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});

export default router;


