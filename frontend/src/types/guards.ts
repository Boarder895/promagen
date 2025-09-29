export type WithVideoUrl<T> = T & { videoUrl?: string };
export function hasVideoUrl<T extends object>(s: T): s is WithVideoUrl<T> {
  return typeof (s as any).videoUrl === 'string' && (s as any).videoUrl.length > 0;
}
