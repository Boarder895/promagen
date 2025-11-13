/**
 * frontend/src/lib/analytics/index.ts
 *
 * Minimal, typed analytics — no shims, no buffers, no defaults.
 * Safe for SSR/tests (no window usage on import).
 */

export type AnalyticsEventName = "tab_click" | "page_view" | "error" | "debug";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface AnalyticsPayload {
  [key: string]: JsonValue;
}

export interface AnalyticsClient {
  track: (name: AnalyticsEventName, payload?: AnalyticsPayload) => void;
  identify?: (userId: string, traits?: AnalyticsPayload) => void;
  setContext?: (ctx: AnalyticsPayload) => void;
  flush?: () => Promise<void> | void;
}

export type TabClickedPayload = {
  id: string;           // stable tab id
  index: number;        // 0-based index
  route?: string;       // path
  labelledBy?: string;  // tablist labelling id
  ts?: number;          // epoch ms
};

let client: AnalyticsClient | null = null;

export function setClient(next: AnalyticsClient) {
  client = next;
}

export function track(name: AnalyticsEventName, payload?: AnalyticsPayload): void {
  try {
    client?.track(name, payload);
  } catch {
    /* analytics must never crash runtime or tests */
  }
}

export function emitTabClicked(input: Omit<TabClickedPayload, "ts">) {
  const payload: TabClickedPayload = { ...input, ts: Date.now() };
  track("tab_click", payload);
}
