import type { ProviderAdapter } from "./types";
function env(name: string, fallback?: string) { const v = process.env[name]; if (!v && fallback === undefined) throw new Error(`Missing env ${name}`); return v ?? fallback!; }

export const httpjsonAdapter: ProviderAdapter = {
  name: env("HTTPJSON_NAME", "httpjson"),
  async chat({ messages, model, temperature, apiKey }) {
    const url = env("HTTPJSON_CHAT_URL", "");
    if (!url) throw new Error("Chat not supported for httpjson");
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", [env("HTTPJSON_AUTH_HEADER","Authorization")]: `${env("HTTPJSON_AUTH_PREFIX","Bearer ")}${apiKey}` }, body: JSON.stringify({ model, temperature, messages }) });
    if (!r.ok) throw new Error(`httpjson chat ${r.status}: ${await r.text()}`);
    const data = await r.json();
    return data?.choices?.[0]?.message?.content ?? data?.output ?? data?.text ?? "";
  },
  async image({ prompt, apiKey, model, size }) {
    const url = env("HTTPJSON_IMAGE_URL", "");
    if (!url) throw new Error("Image not supported for httpjson");
    const body: any = { prompt, model };
    if (size) { const [w,h]=size.split("x").map(Number); if (Number.isFinite(w)&&Number.isFinite(h)) Object.assign(body,{width:w,height:h}); }
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", [env("HTTPJSON_AUTH_HEADER","Authorization")]: `${env("HTTPJSON_AUTH_PREFIX","Bearer ")}${apiKey}` }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`httpjson image ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const out = data?.data?.[0]?.url ?? data?.output_url ?? data?.url ?? data?.images?.[0]?.url;
    if (!out) throw new Error("No image URL in httpjson response");
    return { url: out };
  },
};
