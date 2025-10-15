// Tiny placeholder “decryptor” used during dev.
// Replace with your real decryption later.
export default async function getDecryptedKey(
  provider: string,
  value: string
): Promise<string> {
  // simple convention: if it starts with "enc:", strip the prefix.
  return value?.startsWith("enc:") ? value.slice(4) : value;
}
