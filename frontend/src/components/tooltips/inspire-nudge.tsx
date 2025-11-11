"use client";

import { DiceIcon } from "@/components/ui/emoji";

export default function InspireNudge() {
  return (
    <div
      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
      title="Need a spark? We'll suggest a structured prompt."
    >
      <DiceIcon /> Feeling stuck? Try Inspire Me!
    </div>
  );
}

