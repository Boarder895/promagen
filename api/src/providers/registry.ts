import type { JobStore } from "../jobs/store";

// minimal adapter signature
export type Adapter = (args: {
  store: JobStore;
  jobId: string;
  prompt: string;
  size?: "512x512" | "1024x1024";
}) => Promise<void>;

export type ProviderDef = {
  id: string;
  name: string;
  envKeys?: string[];        // if present, all must be set to be "real"
  adapter?: Adapter | null;  // if present & envKeys satisfied => real
  simulateIfMissing?: boolean; // default true
};

const SIM = true;

// --- OpenAI adapter (real if OPENAI_API_KEY present) ------------------------
const openaiAdapter: Adapter = async ({ store, jobId, prompt, size = "1024x1024" }) => {
  store.start(jobId);
  const key = process.env.OPENAI_API_KEY;
  if (!key) { await store.simulate(jobId, 2500, 0); store.finishOk(jobId, { imageUrl: "https://placehold.co/1024?text=OpenAI+Sim" }); return; }

  // nudge progress while we wait
  const bump = setInterval(() => {
    const j = store.get(jobId);
    if (!j || j.state !== "running") { clearInterval(bump); return; }
    store.setProgress(jobId, Math.min(95, (j.progress ?? 0) + 3));
  }, 300);

  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size }),
  }).catch((e) => ({ ok: false, statusText: String(e) } as any));

  clearInterval(bump);

  if (!resp?.ok) { store.finishError(jobId, `OpenAI failed: ${resp?.statusText ?? "network"}`); return; }

  const data: any = await resp.json().catch(() => ({}));
  const url: string | undefined =
    data?.data?.[0]?.url ??
    (data?.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : undefined);

  store.finishOk(jobId, { imageUrl: url || "https://placehold.co/1024?text=OpenAI" });
};

// --- Registry of 20 providers ----------------------------------------------
export const PROVIDERS: ProviderDef[] = [
  { id: "openai",     name: "OpenAI DALL·E/GPT-Image", envKeys: ["OPENAI_API_KEY"], adapter: openaiAdapter, simulateIfMissing: SIM },
  { id: "stability",  name: "Stability AI",            envKeys: ["STABILITY_API_KEY"], adapter: null, simulateIfMissing: SIM },
  { id: "leonardo",   name: "Leonardo AI",             envKeys: ["LEONARDO_API_KEY"], adapter: null, simulateIfMissing: SIM },
  { id: "i23rf",      name: "I23RF",                   simulateIfMissing: SIM },
  { id: "artistly",   name: "Artistly",                simulateIfMissing: SIM },
  { id: "adobe",      name: "Adobe Firefly",           envKeys: ["ADOBE_API_KEY"],     adapter: null, simulateIfMissing: SIM },
  { id: "midjourney", name: "Midjourney",              envKeys: ["MIDJOURNEY_API_KEY"],adapter: null, simulateIfMissing: SIM },
  { id: "canva",      name: "Canva Text-to-Image",     simulateIfMissing: SIM },
  { id: "bing",       name: "Bing Image Creator",      simulateIfMissing: SIM },
  { id: "ideogram",   name: "Ideogram",                envKeys: ["IDEOGRAM_API_KEY"],  adapter: null, simulateIfMissing: SIM },
  { id: "picsart",    name: "Picsart",                 envKeys: ["PICSART_API_KEY"],   adapter: null, simulateIfMissing: SIM },
  { id: "fotor",      name: "Fotor",                   envKeys: ["FOTOR_API_KEY"],     adapter: null, simulateIfMissing: SIM },
  { id: "nightcafe",  name: "NightCafe",               simulateIfMissing: SIM },
  { id: "playground", name: "Playground AI",           envKeys: ["PLAYGROUND_API_KEY"],adapter: null, simulateIfMissing: SIM },
  { id: "pixlr",      name: "Pixlr",                   simulateIfMissing: SIM },
  { id: "deepai",     name: "DeepAI",                  envKeys: ["DEEPAI_API_KEY"],    adapter: null, simulateIfMissing: SIM },
  { id: "novelai",    name: "NovelAI",                 envKeys: ["NOVELAI_API_KEY"],   adapter: null, simulateIfMissing: SIM },
  { id: "lexica",     name: "Lexica",                  simulateIfMissing: SIM },
  { id: "openart",    name: "OpenArt",                 simulateIfMissing: SIM },
  { id: "flux",       name: "Flux Schnell",            simulateIfMissing: SIM },
];

// Compute “mode” per provider
export function getProviderStatus() {
  return PROVIDERS.map(p => {
    const envOk = (p.envKeys ?? []).every(k => !!process.env[k]);
    const real = !!p.adapter && envOk;
    const simulated = !real && (p.simulateIfMissing !== false);
    return {
      id: p.id,
      name: p.name,
      mode: real ? "real" : simulated ? "simulated" : "disabled",
      envOk,
      requiredEnv: p.envKeys || [],
    };
  });
}

export function findProvider(id: string) {
  return PROVIDERS.find(p => p.id === id) || null;
}
