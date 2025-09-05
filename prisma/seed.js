// C:\Users\Martin Yarnold\Projects\promagen\prisma\seed.js
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const names = [
    'YouTube Shorts',
    'Instagram Reels',
    'TikTok',
    'Pinterest Idea Pins',
    'Facebook Video',
    'LinkedIn Video'
  ];

  for (const name of names) {
    await prisma.platform.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
