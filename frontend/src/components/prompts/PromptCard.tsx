"use client";

import { useState } from "react";
import type { Prompt } from "@/data/prompts";
import { postLike } from "@/lib/api";

export default function PromptCard({
  item,
  onOpen
}: {
  item: Prompt;
  onOpen: (p: Prompt) => void;
}) {
  const [likes, setLikes] = useState(item.likes);
  const [liking, setLiking] = useState(false);

  const like = async () => {
    if (liking) return;
    setLiking(true);
    // optimistic bump
    setLikes((v) => v + 1);
    try {
      const res = await postLike(item.id);
      setLikes(res.likes); // trust server
    } catch {
      // revert on failure
      setLikes((v) => Math.max(item.likes, v - 1));
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className="rounded-2xl border p-4 shadow-sm bg-white">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium">{item.title}</h3>
        <button
          onClick={like}
          disabled={liking}
          className="rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
          aria-label="Like"
        >
          ❤️ {likes}
        </button>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-gray-600">{item.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {item.tags.map((t) => (
          <span key={t} className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] ring-1 ring-gray-200">
            #{t}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500">
        <span>{item.provider}</span>
        <button
          onClick={() => onOpen(item)}
          className="rounded-md border px-2 py-1 hover:bg-gray-50"
        >
          Open
        </button>
      </div>
    </div>
  );
}

