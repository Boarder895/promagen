// src/providers/types.ts
export type SizeKey = "1024x1024" | "1024x1536" | "1536x1024" | "auto";
export type QualityKey = "low" | "medium" | "high" | "auto";

export interface GenOptions {
  size?: SizeKey;
  n?: number;               // images to return (cap per provider)
  model?: string;           // provider-specific model id/name
  quality?: QualityKey;     // mapped per provider; "auto" means omit
  prompt: string;
}

export interface ProviderAdapter {
  name: string;
  generateImages(opts: GenOptions): Promise<string[]>; // array of URLs or data: URLs
}


