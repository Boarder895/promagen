// frontend/src/app/prompts/page.tsx
// Canonical prompts index. Keep this minimal for Stage 1; expand in Stage 2.

export default function PromptsIndexPage() {
  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Prompts</h1>
      <p className="opacity-70 max-w-[65ch]">
        Explore and test prompts. Visit the{" "}
        <a className="underline underline-offset-2" href="/prompts/playground">
          Prompt Playground
        </a>{" "}
        to try ideas live.
      </p>
    </main>
  );
}




