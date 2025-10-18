"use client";
import * as React from "react";

type PromptCardItemProps = {
  id: string;
  title: string;
  prompt: string;
  initialLikes?: number; // may come undefined from server
  onLikeToggle?: (id: string, liked: boolean) => void;
};

export default function PromptCardItem({
  id,
  title,
  prompt,
  initialLikes = 0,
  onLikeToggle,
}: PromptCardItemProps) {
  // make state concrete -> no undefineds
  const [liked, setLiked] = React.useState<boolean>(false);
  const [likes, setLikes] = React.useState<number>(Number.isFinite(initialLikes) ? initialLikes : 0);

  const toggleLike = () => {
    setLiked((prev) => {
      const nextLiked = !prev;
      // use numeric updater with safe base value
      setLikes((prevLikes) => (typeof prevLikes === "number" ? prevLikes : 0) + (nextLiked ? 1 : -1));
      // notify parent if needed
      onLikeToggle?.(id, nextLiked);
      return nextLiked;
    });
  };

  return (
    <li className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{title}</div>
          <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">
            {prompt}
          </pre>
        </div>
        <button
          type="button"
          onClick={toggleLike}
          className={`shrink-0 rounded-full border px-3 py-1 text-sm ${liked ? "bg-black text-white" : ""}`}
          aria-pressed={liked}
        >
          ?? {likes}
        </button>
      </div>
    </li>
  );
}






