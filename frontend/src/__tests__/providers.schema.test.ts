import { describe, it, expect } from "@jest/globals";
import { ProvidersSchema, formatZodError } from "@/data/schemas";

// Require presence and validate strictly — this locks the catalogue.
const providers = require("../data/providers.json");

describe("providers.json schema (strict)", () => {
  it("providers.json exists and is a non-empty array", () => {
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
  });

  it("matches ProvidersSchema exactly", () => {
    const res = ProvidersSchema.safeParse(providers);
    if (!res.success) {
       
      console.error("[providers] schema errors:\n" + formatZodError(res.error));
    }
    expect(res.success).toBe(true);
  });

  it("has unique provider ids", () => {
    const seen = new Set<string>();
    for (const p of providers as Array<{ id: string }>) {
      const id = String(p.id);
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});
