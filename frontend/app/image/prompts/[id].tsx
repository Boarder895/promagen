"use client";

import { useState } from "react";
import { RunAcrossProvidersButton } from "@/components/RunAcrossProvidersButton";

type Prompt = {
  id: string;
  text: string;
};

export default function PromptPage({ params }: { params: { id: string } }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Prompt {params.id}</h1>
      {prompt ? (
        <p className="mb-4">{prompt.text}</p>
      ) : (
        <p className="opacity-70">No prompt loaded yet.</p>
      )}
      {/* New-style usage; still compatible because component now handles both */}
      <RunAcrossProvidersButton promptId={params.id} />
    </main>
  );
}
