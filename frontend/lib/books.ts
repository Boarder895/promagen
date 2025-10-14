// Minimal helpers used by docs/test pages that import `metaOf`.
// Keep types loose; wire to real Metadata later if needed.

export type Meta = Record<string, any>;

export function metaOf(meta: Meta = {}): Meta {
  return {
    title: meta.title ?? 'Promagen',
    description: meta.description ?? '',
    ...meta,
  };
}

export default metaOf;
