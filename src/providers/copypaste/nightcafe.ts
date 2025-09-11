import { PromptFormatter, GenInput } from "../types";

export const nightcafeFormatter: PromptFormatter = {
  name: "nightcafe",
  format(input: GenInput) {
    const np = input.negativePrompt ? ` (avoid: ${input.negativePrompt})` : "";
    const sz = (input.width && input.height) ? ` [${input.width}x${input.height}]` : "";
    return {
      prompt: `${input.prompt}${np}${sz}`,
      tips: ["Paste into nightcafe UI → generate."]
    };
  }
};
