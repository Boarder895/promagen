"use client";
import * as React from "react";

type PromptQuality = "poor" | "ok" | "great";

type Props = {
  quality?: PromptQuality;
  message?: string;
};

export default function FeedbackBar({ quality = "ok", message }: Props) {
  const label =
    quality === "great" ? "High quality prompt" : quality === "poor" ? "Prompt needs detail" : "Prompt is OK";

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="feedback-bar"
      className="mt-2 rounded-xl px-3 py-2 text-xs ring-1 ring-white/10"
    >
      <span className="font-medium">{label}</span>
      {message ? <span className="ml-2 text-white/70">{message}</span> : null}
    </div>
  );
}
