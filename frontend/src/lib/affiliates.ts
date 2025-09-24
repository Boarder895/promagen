import type { Prompt } from "@/hooks/usePrompts";

const A = {
  MIDJOURNEY:
    process.env.NEXT_PUBLIC_AFFILIATE_MIDJOURNEY ??
    "https://www.midjourney.com/home?utm_source=promagen&utm_medium=referral",
  STABLE_DIFFUSION:
    process.env.NEXT_PUBLIC_AFFILIATE_SD ??
    "https://stability.ai?utm_source=promagen&utm_medium=referral",
  LEONARDO:
    process.env.NEXT_PUBLIC_AFFILIATE_LEONARDO ??
    "https://app.leonardo.ai/?utm_source=promagen&utm_medium=referral",
  DALL_E:
    process.env.NEXT_PUBLIC_AFFILIATE_DALLE ??
    "https://labs.openai.com/?utm_source=promagen&utm_medium=referral",
};

export function getAffiliateUrl(p: Prompt): string {
  const provider = (p.provider ?? "").toLowerCase();
  if (provider.includes("midjourney")) return A.MIDJOURNEY;
  if (provider.includes("stable")) return A.STABLE_DIFFUSION;
  if (provider.includes("leonardo")) return A.LEONARDO;
  if (provider.includes("dall")) return A.DALL_E;
  return A.DALL_E;
}
