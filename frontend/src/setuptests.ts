/* eslint-disable @typescript-eslint/no-explicit-any */
// src/setuptests.ts

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'node:util';

/**
 * Global Jest test bootstrap.
 *
 * Goals:
 * - Install TextEncoder/TextDecoder first (several libs expect them).
 * - Provide a safe, no-network fetch stub when fetch is missing.
 * - Provide minimal DOM-ish shims (ResizeObserver, scrollIntoView) for jsdom.
 * - Stay safe when running in **node** test environment (no window / HTMLElement).
 */

// ---- 1) Core encoders expected by some deps -------------------------------

if (!(globalThis as any).TextEncoder) {
  (globalThis as any).TextEncoder = TextEncoder;
}

if (!(globalThis as any).TextDecoder) {
  (globalThis as any).TextDecoder =
    TextDecoder as unknown as typeof globalThis.TextDecoder;
}

// ---- 2) Safe fetch stub (for environments without global fetch) ----------

if (!(globalThis as any).fetch) {
  (globalThis as any).fetch = async () => {
    throw new Error(
      'Unexpected call to global fetch in tests. Use MSW or explicit mocks instead.',
    );
  };
}

// ---- 3) Minimal DOM / browser shims for jsdom tests ----------------------

// We deliberately gate all DOM usage behind runtime checks so that tests
// running under `@jest-environment node` never touch these branches.

if (typeof window !== 'undefined') {
  // 3a) ResizeObserver shim
  if (!(globalThis as any).ResizeObserver) {
    class StubResizeObserver {
      observe(_target: Element): void {
        // no-op in tests
      }

      unobserve(_target: Element): void {
        // no-op in tests
      }

      disconnect(): void {
        // no-op in tests
      }
    }

    (globalThis as any).ResizeObserver = StubResizeObserver;
  }

  // 3b) scrollIntoView shim
  if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value(): void {
        // no-op in tests
      },
    });
  }
}
