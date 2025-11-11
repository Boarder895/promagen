// Promagen privacy-first analytics shim (no PII, dev-friendly logging).
// Meets Standard: no secrets/PII, auditable payloads, production uses sendBeacon.

type EventPayload = Record<string, string | number | boolean | null | undefined>;

const DISALLOWED_KEYS = /(email|phone|name|address|token|cookie|session|auth|passwd|ssn)/i;

export function track(event: string, payload: EventPayload = {}): void {
  try {
    const keys = Object.keys(payload);
    if (keys.some((k) => DISALLOWED_KEYS.test(k))) {
      // eslint-disable-next-line no-console
      console.warn("[analytics] Disallowed key(s) dropped:", keys);
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("[analytics]", event, payload);
      return;
    }

    if (typeof window !== "undefined" && "navigator" in window && "sendBeacon" in navigator) {
      const body = JSON.stringify({ e: event, p: payload, t: Date.now() });
      navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    }
  } catch {
    // swallow — analytics must never crash UX
  }
}
