import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function envKeyFor(provider: string): string | null {
  const map: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    stability: process.env.STABILITY_API_KEY,
    leonardo: process.env.LEONARDO_API_KEY,
    httpjson: process.env.HTTPJSON_API_KEY,
    echo: "echo-no-key"
  };
  return map[provider] ?? null;
}

function decryptKeyFromRecord(_rec: { keyEncrypted: Buffer; iv: Buffer; tag: Buffer }): string | null {
  // Plug your real AES-GCM decrypt here when ready.
  return null;
}

export async function getDecryptedKeyForUserAndProvider(userId: string, provider: string): Promise<string | null> {
  if (provider === "echo") return "echo-no-key";

  try {
    const rec = await prisma.apiKey.findUnique({
      where: { userId_provider: { userId, provider: provider as any } },
      select: { keyEncrypted: true, iv: true, tag: true },
    });
    if (rec) {
      const k = decryptKeyFromRecord({
        keyEncrypted: Buffer.from(rec.keyEncrypted),
        iv: Buffer.from(rec.iv),
        tag: Buffer.from(rec.tag),
      });
      if (k) return k;
    }
  } catch { /* table may not exist yet during early dev */ }

  return envKeyFor(provider);
}
