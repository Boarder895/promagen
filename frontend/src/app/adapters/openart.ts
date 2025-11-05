/// <reference types="node" />
// @ts-nocheck
// Minimal Stage-2 adapter stub for 'openart'.
// Purpose: provide buildPrompt + deepLink helpers so pages can use Copy + Open flows now.
// Replace with full provider-specific logic later (flags, negatives, AR, etc.).

export const id = "openart";

export function buildPrompt(input) {
  // Keep it simple for Stage-2: trim, collapse spaces.
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

export function deepLink(_prompt) {
  // Many providers don't reliably support prefill; default to "copy + open".
  // When prefill becomes available, encodeURIComponent(_prompt) and append here.
  return {
    url: "https://openart.ai/",
    supportsPrefill: false,
    prefilledUrl: "https://openart.ai/"
  };
}

const adapter = { id, buildPrompt, deepLink };
export default adapter;




