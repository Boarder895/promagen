// Docs/book helpers — relaxed but *safe* types so pages compile.

/** Optional metadata blocks some pages read */
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
};

/** Book is now guaranteed to have `sections: []` (never undefined) */
export type Book = {
  id: string;
  title: string;
  meta?: BookMeta;
  meta2?: BookMeta;
  sections: BookSection[];   // <-- not optional anymore
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
    sections: [],             // <-- present
  },
  users: {
    id: 'users',
    title: 'Users Book',
    meta:  { title: 'Users Book' },
    meta2: { title: 'Users Book' },
    sections: [],             // <-- present
  },
};

/** Named helper used by pages */
export function getBook(id: string): Book {
  const b = BOOKS[id] ?? { id, title: id, sections: [] };
  // normalize in case a future entry forgets sections
  return { ...b, sections: b.sections ?? [] };
}

/** Some pages import metaOf() */
export type Meta = Record<string, any>;
export function metaOf(meta: Meta = {}): Meta {
  return { title: meta.title ?? 'Promagen', description: meta.description ?? '', ...meta };
}

/** Default import convenience */
export default getBook;

