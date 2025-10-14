// frontend/providers/registry.ts
import { leonardoProvider } from './api/leonardo';
import { openaiProvider } from './api/openai';
import { stabilityProvider } from './api/stability';

import type { ProviderDef } from './types';

// named imports (match the provider files)

export const REGISTRY: ProviderDef[] = [openaiProvider, stabilityProvider, leonardoProvider];
