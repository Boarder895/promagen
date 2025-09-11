// src/lib/costs.ts
// Central place to estimate credit cost per request across all providers.

export type Provider =
  | "openai"
  | "stability"
  | "leonardo"
  | "deepai"
  | "google"
  | "lexica"
  | "novelai"
  | "edenai"
  | "runware"
  | "hive"
  | "recraft"
  | "flux"
  | "picsart"
  | "httpjson";

type ImageCostInput = {
  provider: Provider;
  model?: string;
  size?: string;    // e.g. "1024x1024", "1792x1024"
  n?: number;       // number of images
  quality?: "standard" | "hd";
};

export function estimateImageCredits(input: ImageCostInput): number {
  const n = Math.max(1, input.n ?? 1);

  const basePerImage = (() => {
    switch (input.provider) {
      case "openai": {
        if (input.quality === "hd") return 2;
        if (input.size === "1792x1024" || input.size === "1024x1792") return 2;
        return 1;
      }
      case "stability":
        return 1; // refine by engine later
      case "leonardo":
        return 1; // refine by model later
      case "deepai":
        return 1;
      case "google":
        return 2; // Imagen often higher cost
      case "lexica":
        return 1;
      case "novelai":
        return 1;
      case "edenai":
        return 1;
      case "runware":
        return 1;
      case "hive":
        return 1;
      case "recraft":
        return 1;
      case "flux":
        return 1;
      case "picsart":
        return 1;
      case "httpjson":
        return 1; // generic fallback
      default:
        return 1;
    }
  })();

  return basePerImage * n;
}
