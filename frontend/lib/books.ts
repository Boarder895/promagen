// Docs/book helpers — relaxed types so pages compile safely.

export type BookMeta = {
  title?: string;
  subtitle?: string;
  [k: string]: any;
};

export type Book = {
  id: string;
  title: string;
  meta?: BookMeta;   // some pages read book.meta?.*
  meta2?: BookMeta;  // some pages read book.meta2?.*
  md?: string;
  html?: string;
  sections?: any[];
};

// Minimal registry; fill out later
const BOOKS: Record<string, Book> = {
  developers: {
    id: 'developers',
    title: 'Developers Book',
    meta: { title: 'Developers Book' },
    meta2: { title: 'Developers Book' },
  },
  users: {
    id: 'users',
    title: 'Users Book',
    meta: { title: 'Users Book' },
    meta2: { title: 'Users Book' },
  },
};

// Named helper used by pages
export function getBook(id: string): Book {
  return BOOKS[id] ?? { id, title: id };
}

// Some pages import metaOf()
export type Meta = Record<string, any>;
export function metaOf(meta: Meta = {}): Meta {
  return { title: meta.title ?? 'Promagen', description: meta.description ?? '', ...meta };
}

// Default import convenience
export default getBook;
