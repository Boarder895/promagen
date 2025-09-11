import { describe, it, expect } from "vitest";
import { getProvider } from "../src/providers/registry";

const ACTIVE = ["openai","stability","leonardo","deepai","google"]; // add more as you wire keys

const PROMPTS = [
  { prompt: "Photorealistic neon mushroom city at dusk, cinematic lighting", width: 1024, height: 1024 },
  { prompt: "Studio portrait of a golden retriever wearing sunglasses on a skateboard", width: 768, height: 768 },
];

for (const name of ACTIVE) {
  describe(`Provider: ${name}`, () => {
    const p = getProvider(name)!;

    for (const input of PROMPTS) {
      it(`generates: ${input.prompt.slice(0, 40)}…`, async () => {
        const out = await p.generate({ ...input, guidance: 7, steps: 25, seed: 42 });
        if (!out.ok) throw new Error(`[${name}] ${out.code}: ${out.message}`);
        expect(out.imageUrls?.length).toBeGreaterThan(0);
      }, 180_000);
    }
  });
}
