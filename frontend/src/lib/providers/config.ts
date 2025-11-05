export type ProviderId =
  | "openai" | "bing" | "midjourney" | "stability" | "leonardo" | "ideogram"
  | "playground" | "nightcafe" | "lexica" | "openart" | "adobe" | "canva"
  | "picsart" | "pixlr" | "deepai" | "fotor" | "flux" | "novelai" | "i23rf" | "artistly";

export type PromptInputs = {
  idea: string;
  negative?: string;
  aspect?: string;
  seed?: string;
  styleTag?: string;
};

export type BuiltPrompt = { text: string; deepLink?: string; note?: string; };

type Builder = (inputs: PromptInputs) => BuiltPrompt;

const enc = (s: string) => encodeURIComponent(s);

export const PROVIDER_BUILDERS: Record<ProviderId, Builder> = {
  openai: ({ idea }) => ({ text: idea.trim(), note: "Prompt copied. Paste into DALL·E 3." }),
  bing: ({ idea }) => ({ text: idea.trim(), note: "Prompt copied. Paste into Bing Image Creator." }),
  midjourney: ({ idea, negative, aspect, seed, styleTag }) => {
    const parts = [styleTag, idea].filter(Boolean) as string[];
    if (aspect) parts.push(`--ar ${aspect}`);
    if (seed) parts.push(`--seed ${seed}`);
    if (negative?.trim()) parts.push(`--no ${negative.trim()}`);
    return { text: parts.join(" "), note: "Copied. Paste into Midjourney (Discord/web)." };
  },
  stability: ({ idea, negative, styleTag }) => {
    const positive = [styleTag, idea].filter(Boolean).join(", ");
    return { text: negative?.trim() ? `${positive}\nNEGATIVE: ${negative.trim()}` : positive, note: "Copied. Use Positive/Negative fields." };
  },
  leonardo: ({ idea, styleTag }) => ({ text: [styleTag, idea].filter(Boolean).join(", "), note: "Copied for Leonardo." }),
  ideogram: ({ idea }) => ({ text: idea.trim(), note: "Copied for Ideogram." }),
  playground: ({ idea, negative, styleTag }) => {
    const positive = [styleTag, idea].filter(Boolean).join(", ");
    return { text: negative?.trim() ? `${positive}\nNEGATIVE: ${negative.trim()}` : positive, note: "Copied for Playground." };
  },
  nightcafe: ({ idea, negative, styleTag }) => {
    const positive = [styleTag, idea].filter(Boolean).join(", ");
    return { text: negative?.trim() ? `${positive}\nNEGATIVE: ${negative.trim()}` : positive, note: "Copied for NightCafe." };
  },
  lexica: ({ idea, negative, styleTag }) => {
    const positive = [styleTag, idea].filter(Boolean).join(", ");
    return { text: negative?.trim() ? `${positive}\nNEGATIVE: ${negative.trim()}` : positive, note: "Copied for Lexica." };
  },
  openart: ({ idea, negative, styleTag }) => {
    const positive = [styleTag, idea].filter(Boolean).join(", ");
    return { text: negative?.trim() ? `${positive}\nNEGATIVE: ${negative.trim()}` : positive, note: "Copied for OpenArt." };
  },
  adobe: ({ idea }) => ({ text: idea.trim(), note: "Copied for Firefly." }),
  canva: ({ idea }) => ({ text: idea.trim(), note: "Copied for Canva." }),
  picsart: ({ idea, styleTag }) => ({ text: [styleTag, idea].filter(Boolean).join(", "), note: "Copied for Picsart." }),
  pixlr: ({ idea, styleTag }) => ({ text: [styleTag, idea].filter(Boolean).join(", "), note: "Copied for Pixlr." }),
  deepai: ({ idea }) => ({ text: idea.trim(), note: "Copied for DeepAI." }),
  fotor: ({ idea, styleTag }) => ({ text: [idea, styleTag].filter(Boolean).join(", "), note: "Copied for Fotor." }),
  flux: ({ idea, styleTag }) => ({ text: [styleTag, idea].filter(Boolean).join(" — "), note: "Copied for Flux." }),
  novelai: ({ idea, styleTag }) => ({ text: [styleTag, idea].filter(Boolean).join(", "), note: "Copied for NovelAI." }),
  i23rf: ({ idea, styleTag }) => ({ text: [idea, styleTag].filter(Boolean).join(", "), note: "Copied for 123RF." }),
  artistly: ({ idea }) => ({ text: idea.trim(), note: "Copied for Artistly." }),
};

// Best-effort deep-links (prompt-only). If unsupported ? return undefined.
export function buildDeepLink(providerId: ProviderId, prompt: string): string | undefined {
  switch (providerId) {
    case "playground": return `https://playgroundai.com/create?prompt=${enc(prompt)}`;
    case "lexica": return `https://lexica.art/?q=${enc(prompt)}`;
    case "openart": return `https://openart.ai/create?prompt=${enc(prompt)}`;
    case "deepai": return `https://deepai.org/machine-learning-model/text2img?text=${enc(prompt)}`;
    default: return undefined;
  }
}





