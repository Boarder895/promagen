// src/pages/prompts/index.tsx
import PromptCard, { Prompt } from '@/components/PromptCard';

export default function PromptsIndex({ prompts }: { prompts: Prompt[] }) {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Prompts</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {prompts.map((p) => (
          <PromptCard key={p.id} prompt={p} />
        ))}
      </div>
    </main>
  );
}


