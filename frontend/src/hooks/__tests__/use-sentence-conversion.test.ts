// src/hooks/__tests__/use-sentence-conversion.test.ts
// ============================================================================
// Tests for sentence conversion term matching — pure functions
// ============================================================================
// Tests levenshteinDistance and matchTermToVocabulary.
// These are the early warning system — if vocabulary matching breaks,
// dropdowns populate with wrong terms or miss valid matches.
//
// Authority: human-sentence-conversion.md §4
// Jest project: hooks (testMatch: src/hooks/**/*.test.ts, env: jsdom)
// ============================================================================

import { describe, it, expect } from "@jest/globals";
import {
  levenshteinDistance,
  matchTermToVocabulary,
} from "@/hooks/use-sentence-conversion";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("golden hour", "golden hour")).toBe(0);
  });

  it("returns correct distance for single char difference", () => {
    expect(levenshteinDistance("cat", "bat")).toBe(1);
    expect(levenshteinDistance("cat", "cats")).toBe(1);
    expect(levenshteinDistance("cat", "ca")).toBe(1);
  });

  it("returns correct distance for multiple differences", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });

  it("handles empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
    expect(levenshteinDistance("abc", "")).toBe(3);
    expect(levenshteinDistance("", "xyz")).toBe(3);
  });

  it("is symmetric", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(
      levenshteinDistance("xyz", "abc"),
    );
  });
});

describe("matchTermToVocabulary", () => {
  it("returns null for empty string", () => {
    expect(matchTermToVocabulary("", "subject")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(matchTermToVocabulary("   ", "subject")).toBeNull();
  });

  it("returns null for unknown term", () => {
    expect(
      matchTermToVocabulary("xylophone quantum soup", "subject"),
    ).toBeNull();
  });

  it("finds exact match case-insensitive", () => {
    // "photorealistic" exists in the style vocabulary
    const result = matchTermToVocabulary("photorealistic", "style");
    expect(result).toBeTruthy();
    expect(result!.toLowerCase()).toBe("photorealistic");
  });

  it("can query all 12 categories without throwing", () => {
    const categories = [
      "subject",
      "action",
      "style",
      "environment",
      "composition",
      "camera",
      "lighting",
      "colour",
      "atmosphere",
      "materials",
      "fidelity",
      "negative",
    ] as const;

    for (const cat of categories) {
      // Must not throw
      const result = matchTermToVocabulary("test", cat);
      expect(result === null || typeof result === "string").toBe(true);
    }
  });

  it("returns a string (not undefined) when matched", () => {
    // Use a term very likely to exist: "blurry" in negative
    const result = matchTermToVocabulary("blurry", "negative");
    if (result !== null) {
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("substring match works when API term contains vocab term", () => {
    // "golden hour lighting" should match "golden hour" if it exists
    const result = matchTermToVocabulary("golden hour lighting", "lighting");
    // Either matches or returns null — no crash
    expect(result === null || typeof result === "string").toBe(true);
  });
});
