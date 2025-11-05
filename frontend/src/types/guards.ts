// src/types/guards.ts
export type WithVideoUrl<T> = T & { videoUrl?: string };

export function hasVideoUrl<T extends { videoUrl?: unknown }>(
  s: T
): s is T & { videoUrl: string } {
  return typeof s.videoUrl === "string" && s.videoUrl.length > 0;
}










