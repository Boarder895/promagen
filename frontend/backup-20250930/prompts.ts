// Popular Prompt Grid â€” seed data (MVP, read-only)
export type Prompt = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  provider: string;        // â€œMidjourneyâ€, â€œDALLÂ·Eâ€, â€œStable Diffusionâ€, etc.
  author: string;
  uses: number;
  likes: number;
  createdAt: string;       // ISO
  curated?: boolean;
};

const curated: Prompt[] = [
  {
    id: "p-hero-landing",
    title: "Hero Landing â€” Product Photo, Clean Gradient",
    summary: "Generate a glossy hero product image on a soft gradient with realistic reflections.",
    body:
      "Ultra-clean hero product shot on a soft radial gradient background. 50mm lens, studio lighting, subtle shadow, glossy reflection on surface, no text, center composition. Photorealistic, high dynamic range.",
    tags: ["product", "hero", "gradient", "photoreal"],
    provider: "Midjourney",
    author: "Promagen Team",
    uses: 12940,
    likes: 2150,
    createdAt: "2025-07-14T12:00:00.000Z",
    curated: true
  },
  {
    id: "p-isometric-city",
    title: "Isometric Neon City Map",
    summary: "Vibrant isometric city with neon accents, readable roads, and minimal clutter.",
    body:
      "Isometric city map, neon accents, grid layout, balanced negative space, readable street labels (no artifacts), soft volumetric light. Render at 4k, crisp edges, minimal signage.",
    tags: ["isometric", "city", "map", "neon"],
    provider: "Stable Diffusion",
    author: "@carto",
    uses: 8420,
    likes: 1450,
    createdAt: "2025-05-30T09:00:00.000Z",
    curated: true
  },
  {
    id: "p-vintage-portrait",
    title: "Vintage 1970s Magazine Portrait",
    summary: "Portrait with 1970s film grain, warm tones, and period typography placeholder.",
    body:
      "1970s magazine portrait, Kodak Portra emulation, warm film grain, subtle halation, soft key light, off-white background, confident pose, no modern objects, shallow depth of field.",
    tags: ["portrait", "film", "vintage", "editorial"],
    provider: "DALLÂ·E",
    author: "Promagen Team",
    uses: 15310,
    likes: 2810,
    createdAt: "2025-06-18T18:22:00.000Z",
    curated: true
  },
  {
    id: "p-ui-wireframe",
    title: "UI Wireframe â€” Greyscale Components",
    summary: "Generate low-fidelity UI screens made of simple boxes, lines, and labels.",
    body:
      "Greyscale UI wireframe screens, simple boxes and lines, clear hierarchy, 12-column grid hints, legible labels, no real brand marks, no color except greys. Export at 1920x1080.",
    tags: ["ui", "wireframe", "greyscale"],
    provider: "Stable Diffusion",
    author: "@uxlabs",
    uses: 6130,
    likes: 980,
    createdAt: "2025-07-01T11:10:00.000Z",
    curated: true
  },
  {
    id: "p-watercolor-botanical",
    title: "Watercolor Botanical Poster",
    summary: "Loose watercolor florals with paper texture and soft ink bleed.",
    body:
      "Watercolor botanical illustration, soft wet-on-wet blends, gentle ink bleed, textured cotton paper background, muted palette, negative space, poster layout, title area left blank.",
    tags: ["watercolor", "botanical", "poster"],
    provider: "DALLÂ·E",
    author: "@atelier",
    uses: 9210,
    likes: 1675,
    createdAt: "2025-04-22T15:42:00.000Z",
    curated: true
  },
  {
    id: "p-sci-fi-corridor",
    title: "Retro-Future Sci-Fi Corridor",
    summary: "Wide-angle corridor with moody lighting and retro-futuristic panels.",
    body:
      "Retro-futuristic sci-fi corridor, wide-angle, moody rim lights, brushed metal panels with analog toggle switches, cinematic framing, subtle fog, 24mm lens look.",
    tags: ["scifi", "environment", "cinematic"],
    provider: "Midjourney",
    author: "Promagen Team",
    uses: 11040,
    likes: 2010,
    createdAt: "2025-03-12T21:05:00.000Z",
    curated: true
  },
  {
    id: "p-ink-animals",
    title: "Minimal Ink Animals â€” Logo-Ready",
    summary: "One-stroke animal marks for identity work.",
    body:
      "Minimal one-stroke animal silhouettes, logo-ready, high contrast black ink on white, perfect vector edges, centered composition, no background elements.",
    tags: ["logo", "minimal", "ink"],
    provider: "Stable Diffusion",
    author: "@brandkit",
    uses: 7015,
    likes: 1332,
    createdAt: "2025-02-07T10:00:00.000Z",
    curated: true
  },
  {
    id: "p-architectural-section",
    title: "Architectural Section â€” Line & Tone",
    summary: "Crisp architectural section drawings with tone-filled rooms.",
    body:
      "Architectural section drawing, clean linework, consistent hatching, tone-filled rooms, human scale figures in profile, labels area left blank, export high DPI.",
    tags: ["architecture", "drawing", "section"],
    provider: "DALLÂ·E",
    author: "@studioK",
    uses: 5120,
    likes: 860,
    createdAt: "2025-01-19T08:40:00.000Z",
    curated: true
  },
  {
    id: "p-food-overhead",
    title: "Overhead Food Board â€” Natural Light",
    summary: "Top-down rustic food spread, natural backlight, wood surface.",
    body:
      "Overhead top-down rustic food board, natural window backlight, wooden surface, shallow props, balanced palette, soft shadows, no messy crumbs, editorial style.",
    tags: ["food", "overhead", "editorial"],
    provider: "Midjourney",
    author: "@cookbook",
    uses: 8990,
    likes: 1550,
    createdAt: "2025-06-05T07:55:00.000Z",
    curated: true
  },
  {
    id: "p-lowpoly-landscape",
    title: "Low-Poly Pastel Landscape",
    summary: "Soft pastel low-poly hills with long shadows.",
    body:
      "Low-poly landscape, soft pastel palette, long evening shadows, gentle gradients, clean sky, isometric-ish perspective, 3D look with crisp edges.",
    tags: ["lowpoly", "pastel", "3d"],
    provider: "Stable Diffusion",
    author: "Promagen Team",
    uses: 4320,
    likes: 720,
    createdAt: "2025-05-11T13:30:00.000Z",
    curated: true
  },
  {
    id: "p-blueprint-vehicle",
    title: "Blueprint Vehicle Orthographic",
    summary: "Orthographic blueprint of a vehicle with dimension lines.",
    body:
      "Vehicle orthographic blueprint, front/side/top, precise line weights, dotted dimension lines, annotations area blank, navy blueprint paper texture, white ink.",
    tags: ["blueprint", "vehicle", "orthographic"],
    provider: "DALLÂ·E",
    author: "@mechanica",
    uses: 6110,
    likes: 1115,
    createdAt: "2025-07-22T19:20:00.000Z",
    curated: true
  },
  {
    id: "p-cinematic-portrait",
    title: "Cinematic Portrait â€” Rembrandt Light",
    summary: "Close-up portrait with Rembrandt triangle and shallow DOF.",
    body:
      "Cinematic portrait, Rembrandt lighting triangle, shallow depth of field, 85mm lens equivalent, muted color grade, film grain subtle, background out of focus.",
    tags: ["portrait", "cinematic", "lighting"],
    provider: "Midjourney",
    author: "@filmframe",
    uses: 12010,
    likes: 2105,
    createdAt: "2025-08-02T22:10:00.000Z",
    curated: true
  }
];

export const seedPrompts = curated;

// Helpers for MVP tabs
export function getCurated(): Prompt[] {
  return seedPrompts.filter(p => p.curated).sort((a,b) => b.likes - a.likes);
}
export function getTrending(): Prompt[] {
  // simple score: likes*2 + uses
  return [...seedPrompts].sort((a,b) => (b.likes*2 + b.uses) - (a.likes*2 + a.uses));
}
export function getCommunity(): Prompt[] {
  // placeholder: none yet
  return [];
}
export function allTags(): string[] {
  const s = new Set<string>();
  seedPrompts.forEach(p => p.tags.forEach(t => s.add(t)));
  return Array.from(s).sort();
}


