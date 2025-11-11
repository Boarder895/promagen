"use client";

import Link from "next/link";
import { BrainIcon, BookmarkIcon } from "@/components/ui/emoji";

export default function TopNav() {
  return (
    <nav className="sticky top-0 z-40 w-full border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-zinc-100">
          Promagen
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/designer"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800"
            title="Prompt Designer — idea builder"
          >
            <BrainIcon /> Prompt Designer
          </Link>

          <Link
            href="/saved"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
            title="Saved prompts & builds (Stage 3)"
          >
            <BookmarkIcon /> My Prompts
          </Link>
        </div>
      </div>
    </nav>
  );
}

