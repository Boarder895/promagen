// frontend/src/lib/a11y.ts
// -----------------------------------------------------------------------------
// Promagen A11y utilities (JSX-free, SSR-safe)
// - usePrefersReducedMotion(): reactively tracks PRM
// - Live region helpers: polite/assertive announcements (throttled)
// - Attribute helpers: aria-pressed/aria-label/data-testid
// - Pause announcement contract
//
// Meets Standard: PRM respected; roles/labels correct; explicit test hooks;
// strict types; en-GB copy; zero globals; no JSX in this file.
// -----------------------------------------------------------------------------

import * as React from "react";

// 1) Reduced motion -----------------------------------------------------------

/** Subscribe to user 'prefers-reduced-motion' (SSR-safe). */
export function usePrefersReducedMotion(): boolean {
  const [prm, setPrm] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrm(Boolean(mq.matches));
    update();

    if ("addEventListener" in mq) {
      // Modern browsers
      (mq as MediaQueryList).addEventListener("change", update);
      return () => (mq as MediaQueryList).removeEventListener("change", update);
    }
    if ("addListener" in mq) {
      // Legacy Safari
      (mq as unknown as { addListener: (cb: () => void) => void }).addListener(update);
      return () =>
        (mq as unknown as { removeListener: (cb: () => void) => void }).removeListener(update);
    }
  }, []);

  return prm;
}

// 2) Live region --------------------------------------------------------------

export type LiveRegionOptions = {
  politeness?: "polite" | "assertive";
  atomic?: boolean;
  throttleMs?: number;
  id?: string; // override default DOM id
};

export type LiveRegionAPI = {
  node: HTMLElement;
  announce: (message: string) => void;
  clear: () => void;
  destroy: () => void;
};

const DEFAULT_LIVE_REGION_ID = "promagen-live-region";

/** Create (or reuse) a live region and expose helpers. */
export function createLiveRegion(opts?: LiveRegionOptions): LiveRegionAPI {
  const {
    politeness = "polite",
    atomic = true,
    throttleMs = 300,
    id = DEFAULT_LIVE_REGION_ID,
  } = opts ?? {};

  if (typeof document === "undefined") {
    const noop = () => {};
    return { node: {} as HTMLElement, announce: noop, clear: noop, destroy: noop };
  }

  let node = document.getElementById(id) as HTMLElement | null;
  if (!node) {
    node = document.createElement("div");
    node.id = id;
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", politeness);
    node.setAttribute("aria-atomic", String(atomic));
    node.setAttribute("data-testid", "live-region");

    Object.assign(node.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      whiteSpace: "nowrap",
      border: "0",
    } as Partial<CSSStyleDeclaration>);

    document.body.appendChild(node);
  } else {
    node.setAttribute("aria-live", politeness);
    node.setAttribute("aria-atomic", String(atomic));
  }

  let last = 0;
  const announce = (message: string) => {
    if (!message || !message.trim()) return;
    const now = Date.now();
    if (now - last < throttleMs) return;
    last = now;

    node!.textContent = "";
    setTimeout(() => {
      node!.textContent = message;
    }, 0);
  };

  const clear = () => {
    node!.textContent = "";
  };

  const destroy = () => {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  };

  return { node, announce, clear, destroy };
}

/** React hook that returns a stable `announce(message)` function. */
export function useLiveAnnouncer(options?: LiveRegionOptions): (message: string) => void {
  const optsRef = React.useRef<LiveRegionOptions>(options ?? {});
  const announcerRef = React.useRef<LiveRegionAPI | null>(null);

  React.useEffect(() => {
    announcerRef.current = createLiveRegion(optsRef.current);
    // Keep the region by default; no teardown.
  }, []);

  return React.useCallback((message: string) => {
    announcerRef.current?.announce(message);
  }, []);
}

/** Alias to preserve older imports in app code. */
export const useLiveRegion = useLiveAnnouncer;

// 3) Attribute helpers --------------------------------------------------------

export function setAriaPressed(el: HTMLElement | null, pressed: boolean): void {
  if (!el) return;
  el.setAttribute("aria-pressed", pressed ? "true" : "false");
}

export function setAriaLabel(el: HTMLElement | null, label?: string): void {
  if (!el) return;
  if (label && label.trim()) el.setAttribute("aria-label", label);
  else el.removeAttribute("aria-label");
}

export function setDataTestId(el: HTMLElement | null, testId: string): void {
  if (!el) return;
  el.setAttribute("data-testid", testId);
}

// 4) Pause contract -----------------------------------------------------------

export const PAUSE_COPY = {
  paused: "Paused — values frozen.",
  live: "Live — updates resumed.",
} as const;

export function announcePauseState(announce: (msg: string) => void, paused: boolean): void {
  const text = paused ? PAUSE_COPY.paused : PAUSE_COPY.live;
  announce(text);
}

// 5) Fire-and-forget singleton announcer -------------------------------------

let _singletonAnnouncer: LiveRegionAPI | null = null;

function getSingletonAnnouncer(): LiveRegionAPI | null {
  if (typeof document === "undefined") return null;
  if (_singletonAnnouncer) return _singletonAnnouncer;
  _singletonAnnouncer = createLiveRegion({ politeness: "polite", atomic: true });
  return _singletonAnnouncer;
}

export function announcePolite(message: string): void {
  getSingletonAnnouncer()?.announce(message);
}

export function clearPoliteRegion(): void {
  getSingletonAnnouncer()?.clear();
}
