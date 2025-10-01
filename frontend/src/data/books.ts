// src/data/books.ts
import raw from "./books.json";

export type BookSection = { title: string; items: string[] };
export type Book = { title: string; sections: BookSection[] };
export type BooksData = {
  userbooks: Book;
  developersBook: Book; // canonical
  buildProgress: { title: string; items: string[] };
};

// Compat alias so old code using ".developers" still works
export type BooksDataCompat = BooksData & { developers: Book };

const data = raw as unknown as BooksData;

export const books: BooksDataCompat = {
  ...data,
  developers: data.developersBook,
};

export default books;


