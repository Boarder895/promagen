export type Book = { id: string; title: string; author?: string };
export const books: Book[] = [];
export async function listBooks(){ return books; }
export default books;
