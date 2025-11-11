"use client";

/**
 * Promagen A11y utilities
 * - usePrefersReducedMotion(): reactively tracks PRM
 * - useLiveRegion(): polite screen-reader announcements
 * - PauseToggle: compact, accessible pause/resume control
 *
 * Meets Standard:
 *  • PRM respected (≤150 ms, easy off switch)
 *  • Roles/labels correct; SR text mirrors visuals
 *  • Test hooks via data-testid
 */

import * as React from "react";

/** Detects and subscribes to user `prefers-reduced-motion` (SSR-safe). */
export function usePrefersReducedMotion(): boolean {
  const [prm, setPrm] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrm(Boolean(mq.matches));
    update();
    // modern browsers
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return prm;
}

/**
 * Creates a single polite live region for SR-only announcements.
 * Usage:
 *   const announce = useLiveRegion();
 *   announce("Loading complete");
 */
export function useLiveRegion() {
  const nodeRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-atomic", "true");
    el.className = "sr-only";
    document.body.appendChild(el);
    nodeRef.current = el;
    return () => {
      el.remove();
      nodeRef.current = null;
    };
  }, []);

  return (text: string) => {
    if (nodeRef.current) nodeRef.current.textContent = text;
  };
}

export type PauseToggleProps = {
  /** Current paused state owned by parent */
  paused: boolean;
  /** Callback with next paused state */
  onChange(paused: boolean): void;
  /** Optional id for labelling */
  id?: string;
  /** Accessible label override (British English) */
  label?: string;
  /** Test id */
  "data-testid"?: string;
};

/**
 * A tiny, accessible pause/resume control for motion or live updates.
 * - Uses aria-pressed
 * - Neutral, concise copy
 * - Minimal styling; inherits theme
 */
export function PauseToggle({
  paused,
  onChange,
  id = "pause-toggle",
  label,
  "data-testid": testId = "pause-toggle",
}: PauseToggleProps) {
  const aria = label ?? (paused ? "Resume live updates" : "Pause live updates");
  return (
    <button
      id={id}
      type="button"
      aria-pressed={paused}
      aria-label={aria}
      onClick={() => onChange(!paused)}
      className="rounded-2xl px-3 py-1 text-xs ring-1 ring-black/10 dark:ring-white/15 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      data-testid={testId}
    >
      {paused ? "Paused" : "Live"}
    </button>
  );
}
