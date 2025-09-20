// Deep-link page that pre-opens a prompt drawer
import PromptGrid from "@/components/prompts/PromptGrid";
import { seedPrompts } from "@/data/prompts";
import { notFound } from "next/navigation";

export function generateMetadata({ params }: { params: { id: string } }) {
  const p = seedPrompts.find((x) => x.id === params.id);
  if (!p) return { title: "Prompt — Not found" };
  return {
    title: `${p.title} — Prompts — Promagen`,
    description: p.summary
  };
}

export default function PromptDetail({ params }: { params: { id: string } }) {
  const p = seedPrompts.find((x) => x.id === params.id);
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Popular Prompts</h1>
        <p className="text-sm text-gray-600">Viewing: {p.title}</p>
      </div>
      <PromptGrid initialId={params.id} />
    </main>
  );
}
