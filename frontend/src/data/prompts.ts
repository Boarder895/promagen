// src/data/prompts.ts
// Canonical prompt types + temporary data fetchers (stubbed until API/DB is wired).

export type Prompt = {
  id: string;
  title: string;
  prompt: string;
  tags?: string[];
  createdAt?: string; // ISO
};

export type PromptQuery = {
  q?: string;
  tag?: string;
  limit?: number;
};

// TODO: replace with real API/DB call; safe empty list is fine for compile.
export async function getCommunity(): Promise<Prompt[]> {
  return [
    {
      id: "starter-1",
      title: "Mushroom town at dusk",
      prompt:
        "Pixarï¿½Ghibli semi-real characters in a glowing mushroom town at dusk, ultra-photorealistic background, cinematic lighting",
      tags: ["fracture", "worldbuilding"],
    },
    {
      id: "starter-2",
      title: "Crystal cave reflections",
      prompt:
        "Dark crystal cave with refractive gemstones, rain-slick rock, volumetric light beams, high contrast mood",
      tags: ["villains", "caves"],
    },
  ];
}





