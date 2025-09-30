import type { Provider } from "@/lib/providers";
import { PROVIDERS } from "@/lib/providers";

export const OPENAI_PROVIDERS: Provider[] = PROVIDERS.filter(p => p.id === "openai");

export function isOpenAIProvider(id: string): boolean {
  return id === "openai";
}