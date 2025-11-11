import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const BASE = SITE.replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/providers"].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: p === "/" ? 1 : 0.6,
  }));
  return pages;
}
