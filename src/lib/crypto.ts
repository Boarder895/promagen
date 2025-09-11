// src/lib/crypto.ts
// AES-256-GCM encryption for API keys + Prisma helpers

import * as crypto from "node:crypto";
import prisma from "./prisma";

const SECRET = process.env.COOKIE_SECRET;
const SALT = "promagen.kdf.v1";

function kdf(): Buffer {
  if (!SECRET || SECRET.length < 8) {
    throw new Error("COOKIE_SECRET missing or too short (set it in .env)");
  }
  return crypto.scryptSync(SECRET, SALT, 32); // 32 bytes -> AES-256
}

export type EncryptedPayload = {
  iv: string;         // base64
  tag: string;        // base64
  cipherText: string; // base64
};

export function encrypt(plain: string): EncryptedPayload {
  const key = kdf();
  const iv = crypto.randomBytes(12); // GCM nonce
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString("base64"), tag: tag.toString("base64"), cipherText: data.toString("base64") };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = kdf();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.cipherText, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString("utf8");
}

// ── Prisma helpers (encrypt at rest)
export async function storeEncryptedKey(provider: string, rawKey: string): Promise<void> {
  const p = encrypt(rawKey);
  await prisma.apiCredential.upsert({
    where: { provider },
    update: { cipherText: p.cipherText, iv: p.iv, tag: p.tag },
    create: { provider, cipherText: p.cipherText, iv: p.iv, tag: p.tag },
  });
}

export async function getDecryptedKey(provider: string): Promise<string | null> {
  const row = await prisma.apiCredential.findUnique({ where: { provider } });
  if (!row) return null;
  return decrypt({ cipherText: row.cipherText, iv: row.iv, tag: row.tag });
}

export async function deleteStoredKey(provider: string): Promise<void> {
  await prisma.apiCredential.deleteMany({ where: { provider } });
}

// default export (keeps ESM/CJS happy)
export default { encrypt, decrypt, storeEncryptedKey, getDecryptedKey, deleteStoredKey };
