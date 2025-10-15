export type Section = { id: string; title: string; href?: string };
export type Book = { id: string; title: string; sections: Section[] };

const demoBook: Book = {
  id: 'developers',
  title: 'Developers Guide (stub)',
  sections: [
    { id: 'intro', title: 'Introduction' },
    { id: 'usage', title: 'Usage' },
  ],
};

export function getBook(id: string): Book {
  // simple, deterministic stub
  return demoBook;
}

export function metaOf(book: Book) {
  return { title: book.title, description: `${book.sections.length} sections` };
}

export default demoBook;

