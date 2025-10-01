"use client";
import { useEffect, useState } from "react";

export default function CopyLinkButton({ anchorId }: { anchorId: string }) {
  const [copied, setCopied] = useState(false);
  const href = typeof window !== "undefined" ? `${location.origin}${location.pathname}#${anchorId}` : `#${anchorId}`;

  return (
    <button
      className="text-xs underline opacity-80 hover:opacity-100"
      onClick={async () => {
        await navigator.clipboard.writeText(href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}


