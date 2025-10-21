// Tiny in-memory prompts list + fetch helper used by the Prompts page.

import type { Prompt } from "@/lib/hooks/usePrompts";

export const prompts: Prompt[] = [
  // seed examples if you like:
  // { id: "hello", title: "Hello World", text: "Say hello", prompt: "Hello!" }
];

export async function getCommunity(): Promise<Prompt[]> {
  // swap for a real fetch later; this keeps the API async for easy replacement
  return prompts;
}




