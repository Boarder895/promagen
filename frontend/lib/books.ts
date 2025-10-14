// Docs/book helpers — relaxed but safe types so pages compile.

/** Optional metadata some pages read */
export type BookMeta = {
  title?: string;
  subtitle?: string;
  [k: string]: any;
};

/** Section shape used by docs pages */
export type BookSection = {
  id?: string;
  title?: string;
  summary?: string;
  status?: string;                 // <-- added
  lastUpdated?: string | number | Date; // <-- added
};

/** Book always has `sections` (never undefined) */
export type Book = {
  id: string;
  title: string;
  meta?: BookMeta;
  meta2?: BookMeta;
  sections: BookSection[];
  md?: string;
  html?: string;
};

// Minimal registry; flesh out later
const BOOKS: Record<string, Book> = {
  developers: {
    id: 'developers',
    title: 'Developers Book',
    meta:  { title: 'Developers Book' },
    meta2: { title: 'Developers Book' },
    sections: [],
  },
  users: {
    id: 'users',
    title: 'Users Book',
    meta:  { title: 'Users Book' },
    meta2: { title: 'Users Book' },
    sections: [],
  },
};

/** Named helper used by pages */
export function getBook(id: string): Book {
  const b = BOOKS[id] ?? { id, title: id, sections: [] };
  return { ...b, sections: b.sections ?? [] };
}

/** Some pages import metaOf() */
export type Meta = Record<string, any>;
export function metaOf(meta: Meta = {}): Meta {
  return { title: meta.title ?? 'Promagen', description: meta.description ?? '', ...meta };
}

/** Default import convenience */
export default getBook;


