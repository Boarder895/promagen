// OpenAI adapter — uses DB-stored key if available, else env
import type { ProviderAdapter } from "./index";
import { getDecryptedKey } from "../lib/crypto"; // your existing helper

async function getKey(): Promise<string> {
  try {
    const k = await getDecryptedKey("openai");
    if (k) return k;
  } catch { /* fall back to env */ }
  const envKey = process.env.OPENAI_API_KEY;
  if (!envKey) throw new Error("Missing OpenAI API key");
  return envKey;
}

const openai: ProviderAdapter = {
  id: "openai",
  label: "OpenAI",
  async test() {
    try {
      const key = await getKey();
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!r.ok) {
        const t = await r.text();
        return { ok: false, message: `HTTP ${r.status}: ${t.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err?.message || String(err) };
    }
  },
};

export default openai;


