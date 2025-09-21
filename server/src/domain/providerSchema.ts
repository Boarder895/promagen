import { z } from "zod";
import { PROVIDERS } from "./providers";

export const ProviderIdSchema = z.enum(PROVIDERS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

import { z } from "zod";
import { PROVIDERS } from "./providers";

export const ProviderIdSchema = z.enum(PROVIDERS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

