// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Model ApiCredential -> client property prisma.apiCredential
  const model = prisma.apiCredential;
  if (!model) {
    console.error('Seed: prisma.apiCredential is undefined. Check schema.prisma (model ApiCredential) and re-generate.');
    process.exit(1);
  }

  const record = {
    provider: 'openai',           // must be in enum Provider
    keyEncrypted: 'placeholder',
    iv: 'placeholder'
  };

  await model.upsert({
    where: { provider: 'openai' },
    update: {},
    create: record
  });

  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

