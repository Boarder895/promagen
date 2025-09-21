// scripts/testProviderEnum.ts
import { PrismaClient } from "@prisma/client";
import { toPrismaProvider, fromPrismaProvider } from "../src/domain/providerMap";

const prisma = new PrismaClient();

async function main() {
  const created = await prisma.providerKey.create({
    data: {
      userId: "test-user-123rf",
      provider: toPrismaProvider("123rf" as any),
      apiKeyEnc: "dummy-encrypted-key"
    },
    select: { id: true, userId: true, provider: true, createdAt: true }
  });
  console.log("Created (DB enum):", created);

  const readBack = await prisma.providerKey.findUnique({
    where: { id: created.id },
    select: { id: true, userId: true, provider: true, createdAt: true }
  });
  if (!readBack) throw new Error("Not found");
  console.log("Read back (app-facing):", { ...readBack, provider: fromPrismaProvider(readBack.provider) });

  await prisma.providerKey.delete({ where: { id: created.id } });
  console.log("Cleanup: deleted", created.id);
}

main().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
}).finally(() => prisma.$disconnect());

