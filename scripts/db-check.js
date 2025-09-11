const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log(await p.apiKey.findMany());
  await p.$disconnect();
})();
