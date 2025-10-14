// Tiny docs helper stubs so pages like /app/docs/** can compile.

export type Book = {
  id: string;
  title: string;
  md?: string;      // markdown source (optional)
  html?: string;    // rendered HTML (optional)
  sections?: any[]; // keep loose for now
};

// Index of known books (fill in later)
const BOOKS: Record<string, Book> = {
  developers: { id: 'developers', title: 'Developers Book' },
  users: { id: 'users', title: 'Users Book' },
};

// Named export used by pages: getBook('developers')
export function getBook(id: string): Book {
  return BOOKS[id] ?? { id, title: id };
}

// Some pages import meta helpers
export type Meta = Record<string, any>;
export function metaOf(meta: Meta = {}): Meta {
  return { title: meta.title ?? 'Promagen', description: meta.description ?? '', ...meta };
}

// Also allow default import style:  import getBook from '@/lib/books'
export default getBook;
