// src/lib/validation.ts
import { z } from "zod";
export const storeKeySchema = z.object({
  provider: z.enum(["artistly","openai","stability","leonardo"]),
  apiKey: z.string().min(10).max(200),
});


