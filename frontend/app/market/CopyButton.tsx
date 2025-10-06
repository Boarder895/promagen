"use client";

export default function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="inline-flex items-center text-xs px-2 py-1 rounded border hover:bg-gray-50 mr-2"
      aria-label="Copy prompt"
      title="Copy prompt"
    >
      Copy
    </button>
  );
}

