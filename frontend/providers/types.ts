// providers/types.ts
export type GenInput = {
  prompt: string;
  negative?: string;
  steps?: number;
  cfg?: number;
  seed?: number;
  size?: string; // e.g. "1024x1024"
  style?: string; // e.g. "photographic"
  [key: string]: unknown;
};

export type GenOutput = {
  ok: boolean;
  url?: string; // image URL or data URI
  data?: string; // image data / data URI
  error?: { code: string; message: string };
  [key: string]: unknown; // provider-specific extras
};

export type ImageProvider = {
  // capability flags (singular keys)
  supportsNegative: boolean;
  supportsSeed: boolean;
  supportsSize: boolean;
  supportsStyle: boolean;

  test(): Promise<{ ok: true }>;
  generate(input: GenInput): Promise<GenOutput>;
};

export type ProviderDef = ImageProvider & {
  id: string; // stable slug e.g., "openai"
  label: string; // UI/export label
  name?: string; // optional internal alias
};
