// frontend/src/components/providers/copy-helper-panel.tsx
"use client";

import { useEffect } from "react";
import { pasteShortcut } from "@/lib/os";

type Props = {
  open: boolean;
  providerName: string;
  onClose: () => void;
  copiedOk: boolean;
  onRetry?: () => void;
};

export default function CopyHelperPanel({
  open,
  providerName,
  onClose,
  copiedOk,
  onRetry,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-neutral-200/60 bg-white/90 p-4 shadow-xl backdrop-blur"
    >
      <div className="mb-2 text-sm font-semibold text-neutral-900">
        {copiedOk ? "Prompt copied" : "Copy may have been blocked"}
      </div>

      {copiedOk ? (
        <p className="text-sm text-neutral-700">
          A new tab for <span className="font-medium">{providerName}</span> opened.
          Switch to it and paste with{" "}
          <kbd className="rounded-md border px-1 py-0.5 text-xs">{pasteShortcut()}</kbd>.
        </p>
      ) : (
        <div className="text-sm text-neutral-700">
          Your browser didn’t allow clipboard write. Click to copy again, then paste with{" "}
          <kbd className="rounded-md border px-1 py-0.5 text-xs">{pasteShortcut()}</kbd>.
          {onRetry && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
              >
                Copy prompt again
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-neutral-500">
          You’re still on Promagen — finish there, we’ll be here.
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
          aria-label="Dismiss helper"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}




