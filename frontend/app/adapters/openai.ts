// Minimal OpenAI adapter wired for the demo pages.

import getDecryptedKey from "@/lib/crypto";

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string; }
export interface ChatRequest { model: string; messages: ChatMessage[]; }
export interface ChatResponse {
  id: string;
  choices: Array<{ message: ChatMessage }>;
  [k: string]: unknown;
}

/** Resolve an API key (and “decrypt” it). Throws if missing. */
async function getOpenAIKey(): Promise<string> {
  const raw =
    process.env.OPENAI_API_KEY ??
    process.env.NEXT_PUBLIC_OPENAI_API_KEY ??
    ""; // ensure plain string (not string | undefined | null)
  const key = await getDecryptedKey("openai", raw);
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return key;
}

/** Minimal chat call to OpenAI. Swap URL/body for your adapter flavor. */
export default async function chat(
  req: ChatRequest,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const key = await getOpenAIKey();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`openai error: ${res.status} ${res.statusText} ${text}`);
  }

  return res.json();
}





