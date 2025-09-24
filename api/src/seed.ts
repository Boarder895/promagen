import { prisma } from "./db/prisma.js";

async function main() {
  const samples = [
    {
      title: "Neon Isometric City Map",
      text: "isometric city map, neon accents, grid layout, readable street labels, soft volumetrics, clean background",
      tags: ["isometric", "neon", "map"],
      provider: "midjourney",
      author: "system",
    },
    {
      title: "Futuristic skyline",
      text: "futuristic skyline at dusk, cinematic composition, reflective glass, high contrast",
      tags: ["city", "future", "cinematic"],
      provider: "sdxl",
      author: "system",
    },
    {
      title: "Cozy cabin in snow",
      text: "a cozy wooden cabin in the snowy mountains, chimney smoke, golden hour rim light",
      tags: ["winter", "landscape", "cozy"],
      provider: "sdxl",
      author: "system",
    },
  ];

  for (const s of samples) {
    // Upsert by title so we can safely re-run seeds.
    await prisma.prompt.upsert({
      where: { id: await findIdByTitle(s.title) },
      update: {
        text: s.text,
        tagsJson: s.tags,
        provider: s.provider,
        author: s.author,
      },
      create: {
        title: s.title,
        text: s.text,
        tagsJson: s.tags,
        provider: s.provider,
        author: s.author,
      },
    });
  }
}

async function findIdByTitle(title: string): Promise<number> {
  const hit = await prisma.prompt.findFirst({ where: { title } });
  return hit?.id ?? 0; // Prisma treats id:0 as non-existing for upsert.where (will fall back to create)
}

main()
  .then(async () => {
    console.log("Seed complete.");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });







