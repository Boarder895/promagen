import type { ProviderId } from "../domain/providers";

export type CanonicalImageRequest = {
  provider: ProviderId;
  model: string;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  quality?: "standard" | "high" | "ultra";
  speed?: "fast" | "balanced" | "slow";
  steps?: number;
  guidance?: number;
  seed?: number | "random";
  upscale?: "none" | "2x" | "4x";
  safety?: "strict" | "standard" | "off";
  format?: "png" | "jpg" | "webp";
  count?: number;
  userId?: string;
  presetId?: string;
};

