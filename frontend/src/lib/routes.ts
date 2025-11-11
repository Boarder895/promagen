/**
 * Canonical routing surface (pages + API).
 * Single source of truth; no ad-hoc strings.
 */

export const ROUTES_VERSION = "v1";

export const Routes = {
  // PAGES
  home: "/" as const,
  providers: "/providers" as const,
  provider: (id: string) => `/providers/${encodeURIComponent(id)}` as const,

  // API
  api: {
    providers: "/api/providers" as const,
    fx: "/api/fx" as const,
    fxLive: "/api/fx/live" as const,
    trackClick: "/api/track-click" as const,
  },
} as const;

export type RouteMap = typeof Routes;

export function withExternalAttrs() {
  return { rel: "noopener noreferrer", target: "_blank" } as const;
}

function isAllowedScheme(u: URL): boolean {
  return u.protocol === "http:" || u.protocol === "https:";
}

/**
 * Builds a safe /api/track-click URL, rejecting javascript:/data:/vbscript: schemes.
 * Lowercases host for normalisation.
 */
export function trackClick(target: string, meta?: Record<string, string | number | boolean>): string {
  let safeTarget = "about:invalid";
  try {
    const u = new URL(target);
    if (isAllowedScheme(u)) {
      u.host = u.host.toLowerCase();
      safeTarget = u.toString();
    }
  } catch {
    // ignore parse errors
  }
  const qs = new URLSearchParams();
  qs.set("target", safeTarget);
  if (meta) for (const [k, v] of Object.entries(meta)) qs.append(k, String(v));
  return `${Routes.api.trackClick}?${qs.toString()}`;
}
