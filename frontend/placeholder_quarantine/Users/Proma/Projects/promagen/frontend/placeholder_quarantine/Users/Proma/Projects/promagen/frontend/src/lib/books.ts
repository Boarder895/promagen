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
  status?: string;
  lastUpdated?: string | number | Date;
};

/** History entry shape used by export/history route */
export type BookHistoryEntry = {
  id?: string;
  text?: string;
  date?: string | number | Date;
};

/** Book always has `sections` and `entries` (never undefined) */
export type Book = {
  id: string;
  title: string;
  meta?: BookMeta;
  meta2?: BookMeta;
  sections: BookSection[];
  entries: BookHistoryEntry[];   // <-- added & required
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
    entries: [],                  // <-- present
  },
  users: {
    id: 'users',
    title: 'Users Book',
    meta:  { title: 'Users Book' },
    meta2: { title: 'Users Book' },
    sections: [],
    entries: [],                  // <-- present
  },
};

/** Named helper used by pages */
export function getBook(id: string): Book {
  const b = BOOKS[id] ?? { id, title: id, sections: [], entries: [] };
  // normalize in case a future entry forgets arrays
  return {
    ...b,
    sections: b.sections ?? [],
    entries: b.entries ?? [],
  };
}

/** Some pages import metaOf() */
export type Meta = Record<string, any>;
export function metaOf(meta: Meta = {}): Meta {
  return { title: meta.title ?? 'Promagen', description: meta.description ?? '', ...meta };
}

/** Default import convenience */
export default getBook;




