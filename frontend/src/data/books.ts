// Tiny client-safe â€œbooksâ€ list used by docs pages.
export type BookSection = { id: string; title: string; text: string; date?: string | number | Date };
export type Book = {
  id: string;
  title: string;
  summary?: string;
  entries?: BookSection[];
  sections?: BookSection[]; // older pages used .sections
  meta?: { title?: string; description?: string };
};

const books: Book[] = [
  {
    id: 'developers',
    title: "Developers' Book",
    summary: 'Notes for dev docs.',
    entries: [],
    sections: []
  }
];

export default books;




