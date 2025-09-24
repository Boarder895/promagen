import type { Prompt } from "@/hooks/usePrompts";

export default function PromptCard({ prompt }: { prompt: Prompt }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-sm font-semibold">{prompt.title}</div>
      <div className="text-xs text-neutral-600">{prompt.summary}</div>
      {prompt.provider ? <div className="mt-1 text-xs text-neutral-500">{prompt.provider}</div> : null}
    </div>
  );
}
