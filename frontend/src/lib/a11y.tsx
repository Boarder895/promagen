import React from "react";

/** Detect user 'prefers-reduced-motion' */
export function usePrefersReducedMotion(): boolean {
  const [prm, set] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => set(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return prm;
}

type PauseToggleProps = {
  paused: boolean;
  onChange(paused: boolean): void;
  id?: string;
};

export function PauseToggle({ paused, onChange, id = "pause-toggle" }: PauseToggleProps) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={paused}
      aria-label={paused ? "Resume live updates" : "Pause live updates"}
      onClick={() => onChange(!paused)}
      className="rounded-2xl px-3 py-1 text-xs ring-1 ring-black/10 dark:ring-white/15 hover:bg-black/5 dark:hover:bg-white/10"
      data-testid="pause-toggle"
    >
      {paused ? "Paused" : "Live"}
    </button>
  );
}
