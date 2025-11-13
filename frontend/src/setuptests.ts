// frontend/src/setuptests.ts
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'node:util';

/**
 * Test bootstrap (SWC only; no Babel, no undici).
 * - Install TextEncoder/TextDecoder first (several libs expect them).
 * - Provide a safe, no-network fetch stub.
 * - Provide minimal DOM-ish shims used by a few tests.
 * - Keep types strict, no `any` except at the global seam.
 */

// 1) Core encoders expected by some deps
if (!('TextEncoder' in globalThis)) {
  (globalThis as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
}
if (!('TextDecoder' in globalThis)) {
  (globalThis as { TextDecoder: typeof TextDecoder }).TextDecoder =
    TextDecoder as unknown as typeof TextDecoder;
}

// 2) Fetch API: neutral stub (tests should not make real network calls)
if (!('fetch' in globalThis)) {
  (globalThis as { fetch: typeof fetch }).fetch = (async () => {
    throw new Error('fetch is not available in unit tests');
  }) as unknown as typeof fetch;
}

// 3) Constructors: minimal shims to satisfy DOM constructor types
if (!('Request' in globalThis)) {
  (globalThis as { Request: typeof Request }).Request =
    (class {} as unknown) as typeof Request;
}
if (!('Response' in globalThis)) {
  (globalThis as { Response: typeof Response }).Response =
    (class {} as unknown) as typeof Response;
}
if (!('Headers' in globalThis)) {
  (globalThis as { Headers: typeof Headers }).Headers =
    (class {} as unknown) as typeof Headers;
}

// 4) Minimal UI polyfills used in a few tests
class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (!('ResizeObserver' in globalThis)) {
  (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = StubResizeObserver;
}

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value(): void {
      /* no-op in tests */
    },
  });
}
