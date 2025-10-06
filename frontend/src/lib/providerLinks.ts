// Named exports only.
// Self-contained link helpers used by UI to build provider routes + query strings.

import type { ProviderId } from "./openAIProviders";

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

/** Append query params to a base URL path. Skips undefined/null/empty-string. */
export const withQuery = (base: string, query?: Query): string => {
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
};

/** Build a canonical provider link like /providers/openai/run?prompt=... */
export const providerLink = (
  providerId: ProviderId,
  path: string = "",
  query?: Query
): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = `/providers/${providerId}${cleanPath === "/"
    ? ""
    : cleanPath}`;
  return withQuery(base, query);
};




