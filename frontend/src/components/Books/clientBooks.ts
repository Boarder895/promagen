"use client";
import books from "@/data/books.json"; // Next can bundle JSON for client

export function loadClientBooks() {
  return books;
}
