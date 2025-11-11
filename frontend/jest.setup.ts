import "@testing-library/jest-dom";
/** ---- JSDOM polyfills for component tests ---- */
if (typeof (global as any).ResizeObserver === "undefined") {
  class RO {
    observe() { /* no-op */ }
    unobserve() { /* no-op */ }
    disconnect() { /* no-op */ }
  }
  ;(global as any).ResizeObserver = RO as any;
  ;(window as any).ResizeObserver  = RO as any;
}

/** Some components call scrollIntoView; stub it for JSDOM */
if (!HTMLElement.prototype.scrollIntoView) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  HTMLElement.prototype.scrollIntoView = function () {};
}
