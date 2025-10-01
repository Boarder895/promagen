// Minimal, typed, and no unused args.

export type ProviderId = "openai" | "anthropic" | "bedrock" | "other";

export type StartGenerationRequest = {
  provider: ProviderId;
  prompt: string;
};

export type StartGenerationResponse = {
  ok: true;
  id: string;
};

export async function startGeneration(req: StartGenerationRequest): Promise<StartGenerationResponse> {
  // TODO: call your API / provider. Placeholder keeps types strict.
  const id = `${req.provider}:${Date.now()}`;
  return { ok: true, id };
}

// Example of the earlier unused-arg issue fixed via underscore
export function generate(_prompt: string): string {
  // Future implementation will use the prompt; underscore keeps ESLint happy meanwhile.
  return "not-implemented";
}

