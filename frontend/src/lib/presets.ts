// src/lib/presets.ts

export type Preset = {
  id: string;
  label: string;
  provider: string;     // e.g., "openai", "anthropic", "groq"
  model: string;        // model name for that provider
  defaults?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
};

/**
 * Keep this list tiny to start. You can grow it later.
 * The UI will read from this at build/runtime.
 */
export const Presets: Preset[] = [
  {
    id: "o3-mini",
    label: "OpenAI o3-mini",
    provider: "openai",
    model: "o3-mini",
    defaults: { temperature: 0.7, maxTokens: 512 }
  },
  {
    id: "gpt-4o-mini",
    label: "OpenAI GPT-4o Mini",
    provider: "openai",
    model: "gpt-4o-mini",
    defaults: { temperature: 0.6, maxTokens: 512 }
  },
  {
    id: "claude-3-haiku",
    label: "Anthropic Claude 3 Haiku",
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    defaults: { temperature: 0.5, maxTokens: 512 }
  }
];
