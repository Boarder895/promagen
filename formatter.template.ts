import { PromptFormatter, GenInput } from "../types";

export const __NAME__Formatter: PromptFormatter = {
  name: "__NAME__",
  format(input: GenInput) {
    const np = input.negativePrompt ? ` (avoid: ${input.negativePrompt})` : "";
    const sz = input.width && input.height ? ` [${input.width}x${input.height}]` : "";
    return {
      prompt: `${input.prompt}${np}${sz}`,
      tips: ["Paste into __NAME__ UI → generate."]
    };
  }
};
