"use client";

import { useState } from "react";

type Props = { id: string; className?: string };

function getDisplayUrlForPromptId(id: string) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/image/prompts/${encodeURIComponent(id)}`;
}

export default function CopyLinkButton({ id, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    const url = getDisplayUrlForPromptId(id);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={className ?? "rounded border px-2 py-1 text-sm"}
      aria-live="polite"
      aria-label={copied ? "Copied link" : "Copy link"}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
