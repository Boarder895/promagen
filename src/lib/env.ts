// Centralised, typed env loader
import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  COOKIE_SECRET: z.string(),

  // Optional provider keys (DB-stored is preferred)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_PROJECT_ID: z.string().optional(),
  STABILITY_API_KEY: z.string().optional(),
  LEONARDO_API_KEY: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
});

export const Env = EnvSchema.parse(process.env);
export type EnvType = z.infer<typeof EnvSchema>;
