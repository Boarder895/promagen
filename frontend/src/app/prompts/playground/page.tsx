'use client';

// Replace the missing component with a simple self-contained page for now.
export default function PromptPlaygroundPage() {
  return (
    <main className="mx-auto max-w-screen-md px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">Prompt Playground</h1>
      <p className="text-sm text-neutral-500 mb-4">Stage-2 placeholder. Paste and iterate quickly.</p>
      <textarea
        className="w-full min-h-[180px] rounded-xl border border-neutral-300 bg-white/70 p-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Describe the image you want…"
      />
      <div className="mt-3 text-xs text-neutral-500">This temporary page removes the missing import error.</div>
    </main>
  );
}

