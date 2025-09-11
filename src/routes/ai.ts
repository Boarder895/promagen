import { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getAdapter, listProviders } from "../providers/registry";
import type { ChatMessage } from "../providers/types";
import { getDecryptedKeyForUserAndProvider } from "../services/keys";

// --------------------------- config ---------------------------
const IMAGES_DIR = path.resolve("public/images");
const MAX_COUNT = Number(process.env.IMAGES_MAX_COUNT ?? 200);         // keep newest N files
const MAX_AGE_HOURS = Number(process.env.IMAGES_MAX_AGE_HOURS ?? 72);  // prune older than N hours
const PRUNE_EVERY_MS = 30 * 60 * 1000; // 30 minutes

const r = Router();

// Ensure folder exists
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// ------------------------ helpers -----------------------------
type ImgMeta = { name: string; size: number; mtimeMs: number };

function listFiles(): ImgMeta[] {
  return fs
    .readdirSync(IMAGES_DIR)
    .filter(n => !n.startsWith("."))
    .map(name => {
      const st = fs.statSync(path.join(IMAGES_DIR, name));
      return { name, size: st.size, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function pruneNow(): { removed: string[]; kept: number } {
  const removed: string[] = [];
  const now = Date.now();
  const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000;

  let files = listFiles();

  // Age-based prune
  for (const f of files) {
    if (maxAgeMs > 0 && now - f.mtimeMs > maxAgeMs) {
      fs.unlinkSync(path.join(IMAGES_DIR, f.name));
      removed.push(f.name);
    }
  }

  // Count-based prune
  files = listFiles();
  if (MAX_COUNT > 0 && files.length > MAX_COUNT) {
    const extra = files.slice(MAX_COUNT);
    for (const f of extra) {
      fs.unlinkSync(path.join(IMAGES_DIR, f.name));
      removed.push(f.name);
    }
  }

  return { removed, kept: listFiles().length };
}

// Kick off background pruner (best-effort, fires in this process)
setInterval(() => {
  try { pruneNow(); } catch { /* ignore */ }
}, PRUNE_EVERY_MS);

// ---------------------- routes: meta --------------------------
r.get("/providers", (_req, res) => {
  res.json({ ok: true, providers: listProviders() });
});

// Simple inspector (handy for debugging)
r.get("/_debug/routes", (_req, res) => {
  const routes: Array<{ methods: string[]; path: string }> = [];
  (r as any).stack?.forEach((l: any) => {
    if (l?.route) {
      const methods = Object.keys(l.route.methods ?? {}).map(m => m.toUpperCase());
      routes.push({ methods, path: l.route.path });
    }
  });
  res.json({ ok: true, routes });
});

// ---------------------- routes: chat --------------------------
const ChatBody = z.object({
  provider: z.string(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  messages: z.array(z.object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string(),
  })),
});

r.post("/chat", async (req, res) => {
  try {
    const { provider, model, temperature, messages } = ChatBody.parse(req.body);
    const adapter = getAdapter(provider);
    if (!adapter?.chat) return res.status(400).json({ ok: false, error: `Chat not supported for '${provider}'` });

    const userId = (req as any).auth?.userId ?? "demo-user";
    const apiKey = await getDecryptedKeyForUserAndProvider(userId, provider);
    if (!apiKey) return res.status(401).json({ ok: false, error: `No API key stored for ${provider}` });

    const text = await adapter.chat({
      messages: messages as ChatMessage[],
      model,
      temperature,
      apiKey,
    });

    res.json({ ok: true, provider, model, text });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// ---------------------- routes: images ------------------------
const ImageBody = z.object({
  provider: z.string(),
  model: z.string().optional(),
  prompt: z.string(),
  size: z.string().optional(), // e.g. "1024x1024"
});

function extFromMime(mime: string) {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  return "png";
}

r.post("/image", async (req, res) => {
  try {
    const { provider, model, prompt, size } = ImageBody.parse(req.body);
    const adapter = getAdapter(provider);
    if (!adapter?.image) return res.status(400).json({ ok: false, error: `Image not supported for '${provider}'` });

    const userId = (req as any).auth?.userId ?? "demo-user";
    const apiKey = await getDecryptedKeyForUserAndProvider(userId, provider);
    if (!apiKey) return res.status(401).json({ ok: false, error: `No API key stored for ${provider}` });

    const { url } = await adapter.image({ prompt, apiKey, model, size });

    // Decide file name and bytes
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rand = crypto.randomBytes(3).toString("hex");
    let filename = `img-${stamp}-${rand}.png`;
    let buffer: Buffer;

    const dataUrl = url.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (dataUrl) {
      const mime = dataUrl[1];
      buffer = Buffer.from(dataUrl[2], "base64");
      filename = `img-${stamp}-${rand}.${extFromMime(mime)}`;
    } else {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Fetch image failed: ${resp.status} ${await resp.text()}`);
      const ct = resp.headers.get("content-type") || "image/png";
      buffer = Buffer.from(await resp.arrayBuffer());
      filename = `img-${stamp}-${rand}.${extFromMime(ct)}`;
    }

    fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);
    const localUrl = `/images/${filename}`;

    // opportunistic prune after creation
    pruneNow();

    res.json({ ok: true, provider, model, url, localUrl, file: filename });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// List images (newest first)
r.get("/images", (_req, res) => {
  const images = listFiles().map(f => ({
    file: f.name,
    url: `/images/${f.name}`,
    size: f.size,
    mtime: f.mtimeMs,
  }));
  res.json({ ok: true, images, maxCount: MAX_COUNT, maxAgeHours: MAX_AGE_HOURS });
});

// Optional: “clear all images” (single, simple endpoint)
r.post("/images/clear", (_req, res) => {
  const files = listFiles();
  for (const f of files) {
    try { fs.unlinkSync(path.join(IMAGES_DIR, f.name)); } catch { /* ignore */ }
  }
  res.json({ ok: true, removed: files.map(f => f.name) });
});

// Stats / debug
r.get("/images/stats", (_req, res) => {
  const files = listFiles();
  res.json({
    ok: true,
    count: files.length,
    newest: files[0]?.name ?? null,
    oldest: files.at(-1)?.name ?? null,
    maxCount: MAX_COUNT,
    maxAgeHours: MAX_AGE_HOURS,
  });
});

export default r;
