import { PromptFormatter, GenInput } from '../types';

export const a123rfFormatter: PromptFormatter = {
  name: 'a123rf',
  format(input: GenInput) {
    const np = input.negativePrompt ? ` (avoid: ${input.negativePrompt})` : '';
    const sz = input.width && input.height ? ` [${input.width}x${input.height}]` : '';
    return {
      prompt: `${input.prompt}${np}${sz}`,
      tips: ['Paste into a123rf UI → generate.'],
    };
  },
};
