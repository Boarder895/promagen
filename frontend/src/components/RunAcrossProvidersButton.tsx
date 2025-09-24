"use client";

import type { Prompt } from "@/hooks/usePrompts";
import { runAcrossProviders } from "@/lib/runAcrossProviders";

export default function RunAcrossProvidersButton({ prompt }: { prompt: Prompt | string }) {
  // Allow a raw string; coerce to a Prompt-like object
  const p: Prompt =
    typeof prompt === "string"
      ? {
          id: "adhoc",
          title: prompt.slice(0, 48) || "Prompt",
          summary: prompt,
          body: prompt,
          uses: 0,
          likes: 0,
          remixes: 0,
        }
      : prompt;

  return (
    <button
      className="mt-3 px-3 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
      onClick={() => runAcrossProviders(p)}
    >
      Run across providers
    </button>
  );
}
