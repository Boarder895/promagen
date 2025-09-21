"use client";

import { useEffect } from "react";
import { getAffiliateUrl } from "@/lib/api";  // Assuming this function returns a URL for a given provider
import type { Prompt } from "@/data/prompts";

interface PromptDrawerProps {
  prompt: Prompt | null;
  onClose: () => void;
}

export default function PromptDrawer({ prompt, onClose }: PromptDrawerProps) {
  // If no prompt is selected, render nothing (drawer closed)
  if (!prompt) return null;

  // Close drawer on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Prepare affiliate link (if any) for the prompt's provider
  const affiliateUrl = prompt.provider ? getAffiliateUrl(prompt.provider) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex">
      {/* Click outside the drawer content to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer content panel */}
      <div className="w-full max-w-md bg-white p-5 overflow-auto">
        <h2 className="text-xl font-semibold mb-3">{prompt.title}</h2>
        <p className="mb-4 whitespace-pre-line">{prompt.body}</p>
        <p className="text-sm text-gray-500 mb-2">
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
            🔗 Open on {prompt.provider} (affiliate link)
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
