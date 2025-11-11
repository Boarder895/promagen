// src/app/adapters/openai.ts
export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string; }
export interface ChatRequest { model: string; messages: ChatMessage[]; }
export interface ChatResponse { id: string; choices: Array<{ message: ChatMessage }>; }

function ensureKey(): void {
  const k = process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "";
  if (!k) {throw new Error("OPENAI_API_KEY is not set");}
}

export default async function chat(_req: ChatRequest, _signal?: AbortSignal): Promise<ChatResponse> {
  ensureKey();

  // Respect AbortSignal if provided (legitimate use of the param)
  if (_signal?.aborted) {
    throw new Error("Request aborted");
  }

  // Echo last user message to prove we used the request object
  const last = [..._req.messages].reverse().find(m => m.role === "user")?.content ?? "";
  const reply = last ? `You said: ${last}` : "Stage 1: demo response";

  return {
    id: "stub",
    choices: [{ message: { role: "assistant", content: reply } }],
  };
}


















