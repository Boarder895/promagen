// src/app/prompts/[id]/page.tsx
import React from "react";
import PromptGrid from "@/components/prompts/PromptGrid";
import { type Prompt } from "@/lib/api";
import { getCommunity } from "@/data/prompts";

type PageProps = { params: { id: string } };

export const revalidate = 60;

export default async function PromptDetailPage({ params }: PageProps) {
  const items: Prompt[] = await getCommunity();
  const p = items.find((x) => x.id === params.id) ?? items[0];

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">{p?.title ?? "Prompt"}</h1>
      <p className="mb-4 text-sm opacity-80">{p?.prompt}</p>

      <h2 className="text-xl font-semibold mt-8 mb-2">Related</h2>
      {/* PromptGrid expects { query?: PromptQuery } only */}
      <PromptGrid query={{ q: p?.title }} />
    </main>
  );
}

