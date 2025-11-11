// Prompt builder: formats user input into provider-native prompt syntax.
// Safe to extend with new providers; keep defaults clean and readable.

export type BuildInput = {
  idea: string;
  negative?: string;
  aspect?: string;
  seed?: string;
  styleTag?: string;
};

export type Built = { text: string; deepLink?: string };

export function buildPrompt(providerId: string, input: BuildInput, website?: string): Built {
  const { idea, negative, aspect, seed, styleTag } = input;
  const base = idea.trim();

  switch (providerId) {
    case 'midjourney': {
      const flags = [
        aspect ? `--ar ${aspect}` : null,
        styleTag ? `--style ${styleTag}` : null,
        negative ? `--no ${negative}` : null,
        seed ? `--seed ${seed}` : null,
      ]
        .filter(Boolean)
        .join(' ');
      return { text: [base, flags].filter(Boolean).join(' ') };
    }

    // SD-style builders (positive/negative separation)
    case 'stability':
    case 'lexica':
    case 'playground':
    case 'nightcafe': {
      const lines = [
        `Positive: ${base}`,
        negative ? `Negative: ${negative}` : null,
        styleTag ? `Style: ${styleTag}` : null,
        aspect ? `Aspect: ${aspect}` : null,
        seed ? `Seed: ${seed}` : null,
      ]
        .filter(Boolean)
        .join('  |  ');
      return { text: lines };
    }

    // Generic default (safe fallback)
    default: {
      const suffix = [
        styleTag ? `style=${styleTag}` : null,
        aspect ? `aspect=${aspect}` : null,
        seed ? `seed=${seed}` : null,
      ]
        .filter(Boolean)
        .join(' ');
      const text = suffix ? `${base}\n\n${suffix}` : base;
      return { text, deepLink: website };
    }
  }
}







