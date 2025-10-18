// frontend/providers/api/_types.ts
// Canonical base shapes used by all image providers (UI/meta flags here).

export type GenInput = {
  prompt: string;
  negative?: string;
  steps?: number;
  cfg?: number | string;
  seed?: number | string;
  size?: string;
  style?: string;
  [key: string]: unknown; // allow provider-specific extras
};

export type GenOutput = {
  ok: boolean;
  url?: string; // image URL / data URI
  data?: string; // image data / data URI
  error?: { code: string; message: string };
  [key: string]: unknown; // provider-specific extras
};

export type ImageProvider = {
  // Capability flags the UI/meta layer reads
  supportsNegative: boolean;
  supportsSeed: boolean;
  supportsSize: boolean;
  supportsStyle: boolean;

  test(): Promise<{ ok: true }>;
  generate(_input: GenInput): Promise<GenOutput>;
};





