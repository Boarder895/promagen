import { z, ZodSchema } from "zod";
export { z };
export type SafeParseResult<T> = { ok: true; data: T } | { ok: false; error: string };
export const parseJson = async <T>(req: Request, schema: ZodSchema<T>): Promise<SafeParseResult<T>> => {
  try { const unknownBody: unknown = await req.json(); const parsed = schema.safeParse(unknownBody);
    if (!parsed.success) { return { ok: false, error: parsed.error.message }; }
    return { ok: true, data: parsed.data };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON body" }; }
};




