// src/data/prompts.ts
import type { Prompt } from "@/lib/api";
export type { Prompt } from "@/lib/api"; // keep this re-export so imports work

// …leave the rest of your seed data and functions as-is…

const SEED_PROMPTS: Prompt[] = [
  {
    id: "seed-1",
    title: "Mushroom City at Dawn",
    prompt: "Ultra-photorealistic fungal skyline with fiber-optic trees, cinematic lighting.",
    summary: "A glowing mushroom metropolis greeting sunrise.",
    description: "Photoreal forest city of colossal mushrooms with warm windows and mist.",
    tags: ["fantasy", "environment"],
    likes: 42,
    author: "System",
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-2",
    title: "Crystal Cavern Throne",
    prompt: "Gem-lit cavern with ominous reflections, semi-realistic cartoon character.",
    summary: "Dark regal throne room inside a jewel cave.",
    description: "Crystalline walls, gem refractions, moody cinematic contrast.",
    tags: ["villain", "cave"],
    likes: 27,
    author: "System",
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-3",
    title: "Unicorn Ridge",
    prompt: "White unicorn with silver mane under storm-lit sky, cinematic depth.",
    summary: "Aurora the unicorn poised on a windswept ridge.",
    description: "Storm clouds, rim lighting, shallow depth of field.",
    tags: ["character", "creature"],
    likes: 31,
    author: "System",
    createdAt: new Date().toISOString(),
  },
];

export async function getCommunity(): Promise<Prompt[]> {
  return SEED_PROMPTS;
}
export async function getTrending(): Promise<Prompt[]> {
  return SEED_PROMPTS.slice(0, 2);
}
export async function getCurated(): Promise<Prompt[]> {
  return SEED_PROMPTS;
}
export const seedPrompts: Prompt[] = SEED_PROMPTS;

export const allTags: string[] = [
  "fantasy",
  "environment",
  "character",
  "villain",
  "city",
  "portrait",
  "poster",
  "concept-art",
];
export const seedAllTags = allTags;


