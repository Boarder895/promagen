// src/lib/providers/index.ts
export type Provider = {
  id: string;
  name: string;
  api?: boolean;
};

export const providers: Provider[] = [
  { id: "openai", name: "OpenAI", api: true },
  { id: "anthropic", name: "Anthropic", api: true },
  { id: "manual", name: "Manual Upload", api: false },
];


