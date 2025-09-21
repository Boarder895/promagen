// src/components/PromptDrawer.tsx
"use client";

import { useEffect } from "react";
import { getAffiliateUrl } from "@/lib/api";
import type { Prompt } from "@/data/prompts";

interface PromptDrawerProps {
  prompt: Prompt | null;
  onClose: () => void;
}

export default function PromptDrawer({ prompt, onClose }: PromptDrawerProps) {
  if (!prompt) return null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const affiliateUrl = getAffiliateUrl(prompt.provider);

  return (
    <div className="fixed inset-0 bg-black/50 flex">
      <div className="flex-1" onClick={onClose} />
      <div className="w-full max-w-md bg-white p-5 overflow-auto">
        <h2 className="text-xl font-semibold mb-3">{prompt.title}</h2>
        <p className="mb-3 whitespace-pre-line">{prompt.body}</p>
        <p className="text-sm text-gray-500 mb-1">
          <strong>Author:</strong> {prompt.author} &nbsp;|&nbsp;
          <strong>Provider:</strong> {prompt.provider}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          <strong>Tags:</strong> {prompt.tags.join(", ")}
        </p>
        {affiliateUrl && (
          <a
            href={affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-blue-600 hover:underline mb-4"
          >
            🔗 Open on {prompt.provider}
          </a>
        )}
        <div className="text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
