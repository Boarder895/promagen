import React from "react";
import { PromptGrid } from "@/components/prompts/PromptGrid"; // named import
import { getCommunity } from "@/data/prompts";
import type { Prompt } from '@/lib/hooks/usePrompts';

export const revalidate = 60;

export default async function PromptsPage() {
  const raw = await getCommunity();
  const items: Prompt[] = raw.map((p: any) => ({
    id: p.id,
    title: p.title ?? p.name ?? "Untitled",
    text: p.text ?? p.prompt ?? "",
    prompt: p.prompt,
  }));

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Prompts</h1>
      <PromptGrid params={{}} allPrompts={items} title="All prompts" />
    </main>
  );
}



