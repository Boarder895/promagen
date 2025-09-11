import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.apiKey.create({
    data: {
      provider: 'openai',
      userId: 'test-user',
      encKey: 'fake-encrypted-key',
    },
  });
  console.log('✅ Seeded API keys');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
