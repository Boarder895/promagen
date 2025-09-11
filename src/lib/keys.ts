// src/lib/keys.ts
// Minimal key helpers so routes compile & run now.
// Later: replace BYOK lookup with your encrypted per-user key store.

export type Provider =
  | "openai" | "stability" | "leonardo" | "deepai" | "google"
  | "lexica" | "novelai" | "edenai" | "runware" | "hive"
  | "recraft" | "flux" | "picsart" | "httpjson";

// Map provider -> env var for your server-owned key
const ENV_MAP: Record<Provider, string> = {
  openai:   "OPENAI_API_KEY",
  stability:"STABILITY_API_KEY",
  leonardo: "LEONARDO_API_KEY",
  deepai:   "DEEPAI_API_KEY",
  google:   "GOOGLE_APPLICATION_CREDENTIALS", // service acct path (special case)
  lexica:   "LEXICA_API_KEY",
  novelai:  "NOVELAI_API_KEY",
  edenai:   "EDENAI_API_KEY",
  runware:  "RUNWARE_API_KEY",
  hive:     "HIVE_API_KEY",
  recraft:  "RECRAFT_API_KEY",
  flux:     "FLUX_API_KEY",
  picsart:  "PICSART_API_KEY",
  httpjson: "HTTPJSON_API_KEY", // optional if you add it
};

// BYOK placeholder: return null until you implement per-user key storage.
export async function getDecryptedKeyForUser(
  _userId: string,
  _provider: Provider
): Promise<string | null> {
  // TODO: fetch user's encrypted key from DB, decrypt, return.
  return null;
}

// Server-owned (HOUSE) key or fallback to env for quick testing.
export async function getProjectKey(provider: Provider): Promise<string | null> {
  const envName = ENV_MAP[provider];
  const val = envName ? process.env[envName] : undefined;
  return val && val.trim() ? val : null;
}
