"use client";

import { useState } from "react";

type CopyButtonProps = {
  text: string;
  className?: string;
  label?: string;
};

export default function CopyButton({ text, className, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {
      // no-op: clipboard might be blocked
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={className}
      aria-live="polite"
      title={label}
    >
      {copied ? "Copied" : label}
    </button>
  );
}









