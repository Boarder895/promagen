// Define the Prompt type for prompt objects
export type Prompt = {
  id: string;
  title: string;
  summary: string;
  body: string;
  author: string;
  provider: string;
  tags: string[];
  curated?: boolean;
  trending?: boolean;
  // add other fields as needed (e.g., likes, createdAt)
};

// Seed prompt data (fallback for offline use)
const seedPrompts: Prompt[] = [
  {
    id: "p1",
    title: "Example Prompt 1",
    summary: "This is a sample prompt summary.",
    body: "Full prompt text for Example Prompt 1...",
    author: "Author One",
    provider: "ProviderA",
    tags: ["example", "test"],
    curated: true,
    trending: true,
  },
  {
    id: "p2",
    title: "Example Prompt 2",
    summary: "Another sample prompt summary for testing.",
    body: "Full prompt text for Example Prompt 2...",
    author: "Author Two",
    provider: "ProviderB",
    tags: ["demo", "sample"],
    curated: false,
    trending: false,
  },
];

// Export seed data and utility functions
export function allTags(): string[] {
  const tagSet = new Set<string>();
  seedPrompts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
  return Array.from(tagSet);
}

export function getCurated(): Prompt[] {
  return seedPrompts.filter((p) => p.curated);
}

export function getTrending(): Prompt[] {
  // In this stub, treat any curated or explicitly trending prompt as "trending"
  return seedPrompts.filter((p) => p.trending || p.curated);
}

export function getCommunity(): Prompt[] {
  return seedPrompts.filter((p) => !p.curated);
}

export { seedPrompts };

