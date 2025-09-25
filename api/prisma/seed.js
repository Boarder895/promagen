import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI (DALL·E / GPT-Image)' },
  { id: 'stability', name: 'Stability AI (Stable Diffusion)' },
  { id: 'leonardo', name: 'Leonardo AI' },
  { id: 'i23rf', name: 'I23RF' },
  { id: 'artistly', name: 'Artistly' },
  { id: 'adobe', name: 'Adobe Firefly' },
  { id: 'midjourney', name: 'Midjourney' },
  { id: 'canva', name: 'Canva Text-to-Image' },
  { id: 'bing', name: 'Bing Image Creator' },
  { id: 'ideogram', name: 'Ideogram' },
  { id: 'picsart', name: 'Picsart' },
  { id: 'fotor', name: 'Fotor' },
  { id: 'nightcafe', name: 'NightCafe' },
  { id: 'playground', name: 'Playground AI' },
  { id: 'pixlr', name: 'Pixlr' },
  { id: 'deepai', name: 'DeepAI' },
  { id: 'novelai', name: 'NovelAI' },
  { id: 'lexica', name: 'Lexica' },
  { id: 'openart', name: 'OpenArt' },
  { id: 'flux', name: 'Flux Schnell' },
];

async function main() {
  for (const p of PROVIDERS) {
    await prisma.provider.upsert({
      where: { id: p.id },
      update: { name: p.name },
      create: p,
    });
  }
  console.log('Seeded providers:', PROVIDERS.length);
}

main().finally(() => prisma.$disconnect());
