"use client";
import { useState } from "react";

export default function CopyCLIButton({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="text-xs underline opacity-80 hover:opacity-100"
      onClick={async () => {
        await navigator.clipboard.writeText(cmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "CLI copied!" : "Copy CLI"}
    </button>
  );
}
