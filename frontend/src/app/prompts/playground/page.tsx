// frontend/src/app/prompts/playground/page.tsx
// Server component wrapper for the Prompt Playground route.
// Renders a client component that owns all interactivity.

import PromptPlayground from "@/components/PromptPlayground";

export default function PromptPlaygroundPage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Prompt Playground</h1>
      <p className="opacity-70 max-w-[65ch]">
        Type a prompt, pick a provider, and run a simulated generation. This page does not
        require any backend—it’s wired to the demo simulator you already have.
      </p>
      <PromptPlayground />
    </main>
  );
}
