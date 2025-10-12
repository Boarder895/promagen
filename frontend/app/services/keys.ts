/**
 * Temporary implementation:
 * - Frontend does not talk to DB; we read provider keys from env.
 * - When you move this to the API with a real Prisma client, replace accordingly.
 */
export async function envKeyFor(provider: string): Promise<string | null> {
  const map: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    // add more providers as you wire them:
    // stability: process.env.STABILITY_API_KEY,
    // replicate: process.env.REPLICATE_API_TOKEN,
  };
  return map[provider] ?? null;
}
