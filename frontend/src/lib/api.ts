// Central API base + tiny metadata helper for pages that import getMeta.
// Ports: UI 3000 / API 3001 in dev; prod default = https://api.promagen.com

// Named exports only (project rule).
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  'https://api.promagen.com';

export type AppMeta = {
  title: string;
  description?: string;
};

// Minimal central meta registry so pages like /app/status/page.tsx
// and /app/test/meta/page.tsx can do: import { getMeta } from '@/lib/api'
const META: Record<string, AppMeta> = {
  status: { title: 'Status · Promagen', description: 'System health and checks.' },
  'test/meta': { title: 'Meta Test · Promagen' },
  default: { title: 'Promagen' },
};

// Safe lookup with sensible fallback.
export function getMeta(key: string): AppMeta {
  return META[key] ?? META.default;
}


