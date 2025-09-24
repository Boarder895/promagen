import useSWR from "swr";
import { apiGet } from "@/lib/api";

export type Prompt = {
  id: string;
  title: string;
  summary: string;
  body: string;
  provider?: string;
  uses: number;
  likes: number;
  remixes: number;
  createdAt?: string;
  tags?: string[];
};

export function usePrompts() {
  const { data, error, isLoading, mutate } = useSWR<Prompt[]>("/prompts", (key: string) => apiGet<Prompt[]>(key));
  return { prompts: data ?? [], error, isLoading, mutate };
}

export function usePrompt(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Prompt | null>(
    id ? `/prompts/${id}` : null,
    (key: string) => apiGet<Prompt>(key)
  );
  return { prompt: data ?? null, error, isLoading, mutate };
}
