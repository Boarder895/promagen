import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import OpenAI from "openai";

export type Size = "256x256" | "512x512" | "1024x1024" | string;

export interface GenArgs {
  provider: "echo" | "openai";
  model?: string;
  prompt: string;
  size?: Size;
}

const IMAGES_DIR = path.resolve("public/images");

async function ensureDir() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

function fname(prefix: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${ts}-${crypto.randomBytes(4).toString("hex")}.png`;
}

async function savePng(fileName: string, data: Buffer) {
  await ensureDir();
  const full = path.join(IMAGES_DIR, fileName);
  await fs.writeFile(full, data);
  return {
    file: fileName,
    localUrl: `/images/${fileName}`,
  };
}

async function generateEcho(prompt: string) {
  // 1×1 transparent PNG (tiny placeholder)
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AApUBjQz3uCkAAAAASUVORK5CYII=";
  const buf = Buffer.from(b64, "base64");
  return savePng(fname("echo"), buf);
}

async function generateOpenAI(model: string | undefined, prompt: string, size: Size | undefined) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your .env and restart.");
  }

  const client = new OpenAI({ apiKey });

  const mdl = model?.trim() || "gpt-image-1";
  const sz = size?.trim() || "1024x1024";

  try {
    const res = await client.images.generate({ model: mdl, prompt, size: sz });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI did not return image data.");
    const buf = Buffer.from(b64, "base64");
    return savePng(fname("openai"), buf);
  } catch (e: any) {
    // surface OpenAI message if present
    const msg =
      e?.response?.data?.error?.message ||
      e?.message ||
      "OpenAI request failed.";
    throw new Error(msg);
  }
}

export async function generateImage(args: GenArgs) {
  const size = (args.size || "1024x1024") as Size;
  if (args.provider === "echo") return generateEcho(args.prompt);
  if (args.provider === "openai") return generateOpenAI(args.model, args.prompt, size);
  throw new Error(`Unknown provider: ${args.provider}`);
}


