import { CanonicalImageRequest } from "./types";
import { CapabilityMatrix } from "../capabilities/matrix";

export function coerceToCapabilities(req: CanonicalImageRequest): CanonicalImageRequest {
  const caps = CapabilityMatrix[req.provider]?.[req.model];
  if (!caps) throw new Error("Unsupported provider/model");

  // Snap size to nearest allowed
  if (caps.sizes) {
    const pick = caps.sizes.reduce((best, cur) => {
      const dist = Math.abs(cur[0] - req.width) + Math.abs(cur[1] - req.height);
      const bestDist = Math.abs(best[0] - req.width) + Math.abs(best[1] - req.height);
      return dist < bestDist ? cur : best;
    }, caps.sizes[0]);
    req.width = pick[0]; req.height = pick[1];
  }

  // Clamp steps/guidance to provider ranges
  if (caps.steps && req.steps !== undefined) {
    req.steps = Math.max(caps.steps.min, Math.min(req.steps, caps.steps.max));
  }

  // Drop unsupported flags
  if (req.upscale && !(caps.upscales ?? []).includes(req.upscale)) req.upscale = "none";
  if (req.format && !(caps.formats ?? []).includes(req.format)) req.format = "png";

  return req;
}
