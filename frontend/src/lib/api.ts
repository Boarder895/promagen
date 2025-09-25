/**
 * src/lib/api.ts
 * SERVER-SAFE: no React hooks here.
 */

import type { Provider } from "./providers";
import PROVIDERS from "./providers";

// Centralised API base (overridable via NEXT_PUBLIC_API_BASE_URL)
export const getApiBase = (): string =>
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "https://api.promagen.com";

// Small JSON helper
async function safeJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ---------------- Providers ----------------

export async function fetchProviders(): Promise<Provider[]> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/v1/providers`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });
    return await safeJson<Provider[]>(res);
  } catch {
    // Fallback to local registry so the UI still renders
    return PROVIDERS;
  }
}

// ---------------- Prompts: types ----------------

export type Prompt = {
  id: string;
  title: string;
  prompt: string;       // full prompt text
  tags: string[];
  likes: number;
  author?: string;
  createdAt?: string;

  // Optional fields used by various pages/components:
  summary?: string;
  description?: string;
  provider?: string;    // e.g., "midjourney", "stability", "leonardo"
  model?: string;
};

export type PromptQuery = {
  q?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
  sort?: "latest" | "top";
};

export type PromptList = {
  items: Prompt[];
  total: number;
  page: number;
  pageSize: number;
};

// ---------------- Prompts: actions ----------------

export async function postLike(
  id: string
): Promise<{ ok: boolean; likes?: number }> {
  const base = getApiBase();
  try {
    const res = await fetch(
      `${base}/api/v1/prompts/${encodeURIComponent(id)}/like`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );
    return await safeJson<{ ok: boolean; likes?: number }>(res);
  } catch {
    // optimistic fallback
    return { ok: true };
  }
}

export async function postRemix(
  id: string,
  data: { title?: string; prompt: string; tags?: string[] }
): Promise<{ ok: boolean; id?: string }> {
  const base = getApiBase();
  try {
    const res = await fetch(
      `${base}/api/v1/prompts/${encodeURIComponent(id)}/remix`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    return await safeJson<{ ok: boolean; id?: string }>(res);
  } catch {
    // local id so UI can continue
    return { ok: true, id: `local-${Date.now()}` };
  }
}

// ---------------- Legacy helper (optional) ----------------
// Some older code expects apiGet<T>(url). Keep it tiny and universal.
export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...(init || {}),
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  return safeJson<T>(res);
}

