// Popular Prompt Grid page route
import PromptGrid from "@/components/prompts/PromptGrid";

export const metadata = {
  title: "Popular Prompts â€” Promagen",
  description: "Curated, trending, and community prompts you can copy and run across providers."
};

export default function PromptsPage({ searchParams }: { searchParams: { id?: string } }) {
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Popular Prompts</h1>
        <p className="text-sm text-gray-600">MVP â€” read-only curated set</p>
      </div>
      <PromptGrid initialId={searchParams?.id} />
    </main>
  );
}

