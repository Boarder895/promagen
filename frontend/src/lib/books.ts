// Facade for docs pages; uses data if present, otherwise safe fallbacks.
type Section = { id: string; title?: string; [k: string]: unknown };
export type Book = { id: string; title?: string; sections: Section[]; [k: string]: unknown };

// Try to load your data module in whatever shape it exports.
let BooksStore: any = null;
try {
  // supports default, named `books`, or plain object
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@/data/books');
  BooksStore = (mod?.default ?? mod?.books ?? mod) as any;
} catch {
  // fine: fallback kicks in
}

export function getBook(id: string): Book {
  if (Array.isArray(BooksStore)) {
    const found = BooksStore.find((b: any) => b?.id === id);
    if (found) return found as Book;
  } else if (BooksStore && typeof BooksStore === 'object' && id in BooksStore) {
    return BooksStore[id] as Book;
  }
  return { id, title: id, sections: [] };
}

export function metaOf(book: Book) {
  return {
    id: book.id,
    title: book.title ?? book.id,
    sections: book.sections?.length ?? 0
  };
}
