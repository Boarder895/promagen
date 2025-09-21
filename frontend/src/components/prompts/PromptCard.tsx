"use client";

import React, { useState } from "react";
import type { Prompt } from "@/data/prompts";

interface PromptCardProps {
  item: Prompt;
  onOpen: (p: Prompt) => void;
}

/**
 * NOTE:
 * This version does NOT import `postLike` from "@/lib/*".
 * It uses a local `sendLike` helper that POSTs to `/api/likes`.
 * That avoids the “no exported member 'postLike'” build error.
 */
export default function PromptCard({ item, onOpen }: PromptCardProps) {
  const [likes, setLikes] = useState<number>(0);
  const [isLiking, setIsLiking] = useState(false);

  async function sendLike(id: string) {
    const res = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      cache: "no-store",
    });

    // If the endpoint doesn't exist yet, fail gracefully.
    if (!res.ok) return null as unknown as { likes: number };

    return (await res.json()) as { likes: number };
  }

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation(); // don’t trigger onOpen
    if (isLiking) return;
    setIsLiking(true);
    try {
      const data = await sendLike(item.id);
      if (data && typeof data.likes === "number") {
        setLikes(data.likes);
      }
    } catch (err) {
      console.error("Like failed:", err);
      // keep current likes value
    } finally {
      setIsLiking(false);
    }
  };

  const handleOpen = () => onOpen(item);

  return (
    <div
      onClick={handleOpen}
      className="rounded-xl border p-4 hover:bg-gray-50 cursor-pointer"
    >
      <h3 className="font-medium text-gray-900">{item.title}</h3>
      <p className="text-sm text-gray-600">{item.summary}</p>
      <div className="text-xs text-gray-500">
        {item.author} – {item.provider}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleLike}
          disabled={isLiking}
          className="text-sm text-blue-600 hover:underline disabled:opacity-50"
        >
          ♥ Like ({likes})
        </button>

        <button
          type="button"
          onClick={handleOpen}
          className="text-sm text-gray-600 hover:underline"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
