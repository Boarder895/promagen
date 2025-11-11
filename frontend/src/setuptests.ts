// frontend/src/setuptests.ts
// -----------------------------------------------------------------------------
// Promagen Jest setup — React Testing Library + robust polyfills + a11y helpers
// -----------------------------------------------------------------------------
//
// Goals (from the Promagen Global Standard):
// - Stable, deterministic tests (Europe/London time zone)
// - Accessibility-first (jest-dom + jest-axe matchers available everywhere)
// - No flakiness from missing DOM APIs (ResizeObserver, IntersectionObserver,
//   matchMedia, scrollIntoView, requestAnimationFrame, URL.createObjectURL)
// - Neutral motion by default (prefers-reduced-motion = true in tests)
// - Clean console (surface real errors; keep noise down)
//
// This file is executed automatically by Jest before each test file.
// -----------------------------------------------------------------------------

// 1) Environment & locale -----------------------------------------------------------------

// Force tests to run in a stable time zone (24h clock rules, HH:mm, etc.)
process.env.TZ = 'Europe/London';

// 2) Testing Library & a11y matchers -------------------------------------------------------

import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';

// 3) Node ? Web polyfills (JSDOM gaps) -----------------------------------------------------

// TextEncoder/TextDecoder (sometimes required by Next.js internals)
import { TextEncoder, TextDecoder } from 'util';
(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;

// crypto.getRandomValues (required by some libs; Node 18+ usually has this)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto');
  if (!globalThis.crypto) {
    (globalThis as any).crypto = nodeCrypto.webcrypto;
  }
} catch {
  // ignore (tests that need crypto should bring their own mock)
}

// requestAnimationFrame / cancelAnimationFrame
if (!globalThis.requestAnimationFrame) {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
}
if (!globalThis.cancelAnimationFrame) {
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as NodeJS.Timeout);
}

// DOMRect (used by layout calculations in some components)
if (typeof (globalThis as any).DOMRect === 'undefined') {
  (globalThis as any).DOMRect = class DOMRectPolyfill {
    x = 0; y = 0; width = 0; height = 0; top = 0; left = 0; bottom = 0; right = 0;
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x; this.y = y; this.width = width; this.height = height;
      this.top = y; this.left = x; this.bottom = y + height; this.right = x + width;
    }
    static fromRect(rect: Partial<DOMRect> = {}) {
      return new (this as any)(rect.x ?? 0, rect.y ?? 0, rect.width ?? 0, rect.height ?? 0);
    }
  };
}

// URL.createObjectURL / revokeObjectURL (avoid blob crashes in tests)
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:jest-mock-object-url';
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {};
}

// 4) Observers & scrolling -----------------------------------------------------------------

// ResizeObserver (lightweight no-op that still calls the callback on observe)
class JestResizeObserver {
  private readonly cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; }
  observe(target: Element) {
    // trigger once with empty box sizes so components that attach observers don't blow up
    this.cb(
      [{ target } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? JestResizeObserver;

// IntersectionObserver (minimal, always-intersecting by default)
class JestIntersectionObserver {
  constructor(public _cb: IntersectionObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
(globalThis as any).IntersectionObserver =
  (globalThis as any).IntersectionObserver ?? JestIntersectionObserver;

// scrollIntoView (safe no-op)
if (!HTMLElement.prototype.scrollIntoView) {
  // eslint-disable-next-line no-extend-native
  HTMLElement.prototype.scrollIntoView = function scrollIntoView() { /* no-op */ };
}

// 5) matchMedia — default to reduced motion, stable queries --------------------------------

declare global {
  // Narrow window type to appease TS in tests.
  // JSDOM uses Window & typeof globalThis — we just extend it here.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Window { }
}

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => {
      // Honour reduced-motion by default in tests to keep animations quiet
      const prefersReducedMotion = /prefers-reduced-motion/.test(query);
      return {
        matches: prefersReducedMotion ? true : false,
        media: query,
        onchange: null,
        addListener: () => {},            // deprecated but some libs still call these
        removeListener: () => {},         // deprecated
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList;
    },
  });
}

// 6) Scroll measurement helpers some libs expect -------------------------------------------

// getBoundingClientRect default (returns 0s) — components can override in tests as needed
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
if (!originalGetBoundingClientRect) {
  // eslint-disable-next-line no-extend-native
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0,
      toJSON() { return this; },
    } as DOMRect;
  };
}

// 7) Console hygiene (surface errors, mute React act warnings noise) -----------------------

// Keep console.error but collapse the extremely noisy "act(...)" hints that come from
// libraries we don't control. If an error looks serious, we still let it through.
const consoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('Warning: An update to') && first.includes('not wrapped in act')) {
    // soften this to avoid drowning meaningful test output
    return;
  }
  consoleError(...args);
};

// 8) AfterEach safety net ------------------------------------------------------------------

// Ensure timers are cleared and mocks are restored after every test file.
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// 9) TypeScript globals for completeness ---------------------------------------------------

export {};
