// src/routes/openai.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { getDecryptedKey } from "../lib/crypto"; // path is correct from src/routes/*
import { getDecryptedKey } from "../lib/crypto.ts";
const router = Router();

// Validate incoming chat requests
const ChatSchema = z.object({
  model: z.string().default("gpt-4o-mini"),
  temperature: z.number().min(0).max(2).default(0.2),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      })
    )
    .nonempty("messages must contain at least 1 item"),
});

// POST /api/ai/openai/chat  → forward to OpenAI
router.post("/api/ai/openai/chat", async (req: Request, res: Response) => {
  try {
    const body = ChatSchema.parse(req.body ?? {});
    const apiKey = (await getDecryptedKey("openai")) || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return res.status(401).json({ ok: false, error: "No OpenAI key stored" });

    const client = new OpenAI({ apiKey });

    // Simple timeout so we don’t hang forever
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 25_000);

    const completion = await client.chat.completions.create(
      {
        model: body.model,
        temperature: body.temperature,
        messages: body.messages,
      },
      { signal: ac.signal }
    );

    clearTimeout(t);

    const text =
      completion.choices?.[0]?.message?.content ??
      completion.choices?.[0]?.message?.refusal ??
      "";

    return res.json({ ok: true, model: body.model, text });
  } catch (err: any) {
    const msg = err?.message || String(err);
    // OpenAI SDK gives AbortError on timeout
    if (msg.includes("aborted")) return res.status(504).json({ ok: false, error: "Upstream timeout" });
    if (err?.status) return res.status(err.status).json({ ok: false, error: msg });
    return res.status(500).json({ ok: false, error: msg });
  }
});

// GET /api/ai/openai/models → list models (handy for a dropdown)
router.get("/api/ai/openai/models", async (_req: Request, res: Response) => {
  try {
    const apiKey = (await getDecryptedKey("openai")) || process.env.OPENAI_API_KEY || "";
    if (!apiKey) return res.status(401).json({ ok: false, error: "No OpenAI key stored" });

    const client = new OpenAI({ apiKey });
    const list = await client.models.list();

    return res.json({
      ok: true,
      models: list.data
        .map(m => ({ id: m.id, created: m.created }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (err?.status) return res.status(err.status).json({ ok: false, error: msg });
    return res.status(500).json({ ok: false, error: msg });
  }
});

export default router;

