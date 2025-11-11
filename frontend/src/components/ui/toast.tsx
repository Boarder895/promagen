"use client";
import * as React from "react";

type ToastProps = {
  show?: boolean;
  title?: string;
  subtitle?: string;
  onDone?: () => void;
  duration?: number; // ms
};

export default function Toast({
  show = false,
  title = "Done",
  subtitle,
  onDone,
  duration = 2000,
}: ToastProps) {
  const [visible, setVisible] = React.useState(show);

  React.useEffect(() => {
    if (!show) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => { setVisible(false); onDone?.(); }, duration);
    return () => clearTimeout(t);
  }, [show, duration, onDone]);

  if (!visible) {return null;}

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-white shadow-lg backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        <div className="flex-1">
          <div className="text-sm font-medium">{title}</div>
          {subtitle && <div className="text-xs opacity-80">{subtitle}</div>}
        </div>
        <button
          type="button"
          aria-label="Close"
          className="ms-2 text-xs opacity-70 hover:opacity-100"
          onClick={() => { setVisible(false); onDone?.(); }}
        >
          ?
        </button>
      </div>
    </div>
  );
}

// Minimal shim so `import { useToast } from "@/components/ui/toast"` keeps working.
// Stage-1/2: it's a no-op; wire it up later if you want global toasts.
type PushArgs = { title?: string; subtitle?: string; duration?: number; onDone?: () => void };
export function useToast() {
  const push = React.useCallback((_args?: PushArgs) => { /* no-op for now */ }, []);
  return { push };
}


