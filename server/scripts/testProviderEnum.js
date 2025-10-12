const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// inline tiny mapper to keep this script standalone
function toPrismaProvider(id) { return /^[0-9]/.test(id) ? "_" + id : id; }
function fromPrismaProvider(p) { const s = String(p); return /^_[0-9]/.test(s) ? s.slice(1) : s; }

(async () => {
  try {
    const created = await prisma.providerKey.create({
      data: {
        userId: "test-user-123rf",
        provider: toPrismaProvider("123rf"),
        apiKeyEnc: "dummy-encrypted-key"
      },
      select: { id: true, userId: true, provider: true, createdAt: true }
    });
    console.log("Created (DB view):", created);

    const readBack = await prisma.providerKey.findUnique({
      where: { id: created.id },
      select: { id: true, userId: true, provider: true, createdAt: true }
    });

    console.log("Read back (app view):", { ...readBack, provider: fromPrismaProvider(readBack.provider) });

    await prisma.providerKey.delete({ where: { id: created.id } });
    console.log("Cleanup: deleted", created.id);
  } catch (e) {
    console.error("Test failed:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
