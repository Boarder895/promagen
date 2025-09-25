"use client";

import React, { useState } from "react";
import type { Prompt } from "@/lib/api";
import { postLike, postRemix } from "@/lib/api";

export default function PromptCard({ item }: { item: Prompt }) {
  const [likes, setLikes] = useState<number>(
    typeof item.likes === "number" ? item.likes : 0
  );
  const [busy, setBusy] = useState<boolean>(false);

  async function onLike() {
    try {
      setBusy(true);
      const res = await postLike(item.id);
      // Always pass a number to setLikes
      setLikes(typeof res.likes === "number" ? res.likes : likes + 1);
    } catch {
      setLikes((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }

  async function onRemix() {
    try {
      setBusy(true);
      await postRemix(item.id, {
        title: `${item.title} (remix)`,
        prompt: item.prompt,
        tags: item.tags,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="font-semibold">{item.title}</div>
      <div className="text-sm opacity-80 mt-1">{item.prompt}</div>
      {item.summary && <div className="text-xs mt-1 opacity-70">{item.summary}</div>}
      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={onLike}
          disabled={busy}
        >
          ❤️ {likes}
        </button>
        <button
          type="button"
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={onRemix}
          disabled={busy}
        >
          Remix
        </button>
      </div>
    </div>
  );
}


