export type GenInput = { prompt: string };

export type GenOutput = {
  url?: string; // e.g. CDN URL for the image
  data?: string; // base64 payload (optional)
  error?: string; // provider-specific failure message
};

/** The promise that resolves to a health result */
export type PromiseGenHealth = Promise<{ ok: boolean; message?: string }>;

export interface ImageProvider {
  id: string; // short id used in config URLs
  label: string; // human label in UI
  test?: () => PromiseGenHealth; // optional health probe
  generate: (input: GenInput) => Promise<GenOutput>;
}
