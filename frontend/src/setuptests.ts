// frontend/src/setuptests.ts
//
// Global Jest test bootstrap.
//
// Goals:
// - Install TextEncoder/TextDecoder first (several libs expect them).
// - Provide safe, no-network fetch stubs when fetch/Request/Response/Headers are missing.
// - Provide minimal DOM-ish shims (ResizeObserver, matchMedia, scrollIntoView) for jsdom.
// - Stay safe when running in **node** test environment (no window / HTMLElement).

import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';
import { randomUUID as nodeRandomUUID } from 'node:crypto';

type HeaderInitLike =
  | Record<string, string>
  | Iterable<readonly [string, string]>
  | Array<readonly [string, string]>;

function normaliseHeaderName(name: string): string {
  return String(name).trim().toLowerCase();
}

class TestHeaders {
  private readonly map = new Map<string, string>();

  constructor(init?: HeaderInitLike) {
    if (!init) return;

    if (Array.isArray(init)) {
      for (const [k, v] of init) this.set(k, v);
      return;
    }

    const maybeIterable = init as unknown as { [Symbol.iterator]?: unknown };
    if (typeof maybeIterable[Symbol.iterator] === 'function') {
      for (const pair of init as Iterable<readonly [string, string]>) {
        const [k, v] = pair;
        this.set(k, v);
      }
      return;
    }

    for (const [k, v] of Object.entries(init as Record<string, string>)) {
      this.set(k, v);
    }
  }

  get(name: string): string | null {
    const key = normaliseHeaderName(name);
    return this.map.has(key) ? this.map.get(key) ?? null : null;
  }

  set(name: string, value: string): void {
    const key = normaliseHeaderName(name);
    this.map.set(key, String(value));
  }

  append(name: string, value: string): void {
    const key = normaliseHeaderName(name);
    const existing = this.map.get(key);
    if (existing) this.map.set(key, `${existing}, ${String(value)}`);
    else this.map.set(key, String(value));
  }
}

type RequestInitLike = {
  method?: string;
  headers?: HeaderInitLike;
};

class TestRequest {
  public readonly url: string;
  public readonly method: string;
  public readonly headers: TestHeaders;

  constructor(input: string, init?: RequestInitLike) {
    this.url = String(input);
    this.method = init?.method ? String(init.method).toUpperCase() : 'GET';
    this.headers = new TestHeaders(init?.headers);
  }
}

type ResponseInitLike = {
  status?: number;
  headers?: HeaderInitLike;
};

class TestResponse {
  public readonly status: number;
  public readonly headers: TestHeaders;
  public readonly body: string | null;

  constructor(body?: string | null, init?: ResponseInitLike) {
    this.body = body === undefined ? null : body;
    this.status = init?.status ?? 200;
    this.headers = new TestHeaders(init?.headers);
  }

  static redirect(url: string, status = 302): TestResponse {
    const res = new TestResponse(null, { status });
    res.headers.set('location', url);
    return res;
  }
}

function ensureTextEncoding(): void {
  const g = globalThis as unknown as {
    TextEncoder?: typeof TextEncoder;
    TextDecoder?: typeof TextDecoder;
  };

  if (!g.TextEncoder) g.TextEncoder = TextEncoder;
  if (!g.TextDecoder) g.TextDecoder = TextDecoder;
}

function ensureCrypto(): void {
  // Some older node/jsdom setups lack crypto.randomUUID.
  const g = globalThis as unknown as { crypto?: unknown };

  const current = g.crypto as { randomUUID?: unknown } | undefined;

  if (!current) {
    g.crypto = { randomUUID: () => nodeRandomUUID() };
    return;
  }

  const hasRandomUUID = typeof current.randomUUID === 'function';
  if (!hasRandomUUID) {
    Object.defineProperty(current, 'randomUUID', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: () => nodeRandomUUID(),
    });
  }
}

function ensureFetchPrimitives(): void {
  const g = globalThis as unknown as {
    fetch?: unknown;
    Headers?: unknown;
    Request?: unknown;
    Response?: unknown;
  };

  if (!g.Headers) {
    g.Headers = TestHeaders as unknown as typeof Headers;
  }

  if (!g.Request) {
    g.Request = TestRequest as unknown as typeof Request;
  }

  if (!g.Response) {
    g.Response = TestResponse as unknown as typeof Response;
  }

  if (!g.fetch) {
    const noNetworkFetch = async (): Promise<never> => {
      throw new Error('fetch() is not available in the Jest environment (network is disabled).');
    };

    g.fetch = noNetworkFetch as unknown as typeof fetch;
  }
}

function ensureDomShims(): void {
  if (typeof window === 'undefined') return;

  // matchMedia shim (used by reduced-motion + tab components)
  if (!window.matchMedia) {
    window.matchMedia = ((query: string): MediaQueryList => {
      const mql: MediaQueryList = {
        media: query,
        matches: false,
        onchange: null,
        addListener: () => {
          // deprecated no-op
        },
        removeListener: () => {
          // deprecated no-op
        },
        addEventListener: () => {
          // no-op
        },
        removeEventListener: () => {
          // no-op
        },
        dispatchEvent: () => false,
      };

      return mql;
    }) as unknown as typeof window.matchMedia;
  }

  // ResizeObserver shim
  const g = globalThis as unknown as { ResizeObserver?: unknown };
  if (!g.ResizeObserver) {
    class StubResizeObserver {
      observe(): void {
        // no-op in tests
      }
      unobserve(): void {
        // no-op in tests
      }
      disconnect(): void {
        // no-op in tests
      }
    }

    g.ResizeObserver = StubResizeObserver;
  }

  // scrollIntoView shim
  if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.scrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value(): void {
        // no-op in tests
      },
    });
  }

  // scrollTo shim (some components assume it exists)
  if (!window.scrollTo) {
    window.scrollTo = (() => {
      // no-op in tests
    }) as unknown as typeof window.scrollTo;
  }
}

ensureTextEncoding();
ensureCrypto();
ensureFetchPrimitives();
ensureDomShims();
